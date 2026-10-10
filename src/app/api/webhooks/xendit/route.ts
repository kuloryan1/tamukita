import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { eventStartsAt, invitationTitle, parseInvitationDraft } from "@/lib/invitation-server";
import { getPrismaClient } from "@/lib/prisma";
import { recalculateRefundedOrder, restoreResellerCreditsAfterFailedRefund } from "@/lib/refunds";
import { lockResellerCreditBalance } from "@/lib/reseller-credits";

export const runtime = "nodejs";

type XenditSessionWebhook = {
  event?: string;
  data?: {
    payment_session_id?: string;
    reference_id?: string;
    payment_id?: string | null;
    payment_request_id?: string | null;
    id?: string;
    failure_code?: string | null;
    status?: string;
    amount?: number;
    currency?: string;
  };
};

function matchesToken(expected: string, actual: string) {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

async function processRefundWebhook(payload: XenditSessionWebhook, rawBody: string) {
  const data = payload.data;
  const eventType = payload.event;
  const expectedStatus = eventType === "refund.succeeded" ? "SUCCEEDED" : "FAILED";
  if (!data?.id || !data.reference_id || !data.payment_request_id || !Number.isSafeInteger(data.amount) || !data.currency || data.status !== expectedStatus) {
    return NextResponse.json({ error: "Payload refund tidak valid." }, { status: 400 });
  }
  const prisma = getPrismaClient();
  const providerEventId = createHash("sha256").update(eventType ?? "").update(":").update(data.id).digest("hex");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const priorEvent = await tx.paymentEvent.findUnique({ where: { provider_providerEventId: { provider: "XENDIT", providerEventId } }, select: { id: true } });
      if (priorEvent) return { duplicate: true, processed: true };
      const initialRefund = await tx.refund.findUnique({
        where: { referenceId: data.reference_id },
        include: {
          paymentSession: { select: { providerPaymentRequestId: true } },
          order: { select: { id: true, organizationId: true, items: { select: { itemType: true } } } },
        },
      });
      if (!initialRefund) return { duplicate: false, processed: false, missing: true };
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${initialRefund.order.id}::uuid FOR UPDATE`;
      if (initialRefund.order.items.some((item) => item.itemType === "RESELLER_CREDIT")) {
        await lockResellerCreditBalance(tx, initialRefund.order.organizationId);
      }
      const refund = await tx.refund.findUnique({
        where: { id: initialRefund.id },
        include: {
          paymentSession: { select: { providerPaymentRequestId: true } },
          order: { select: { id: true, organizationId: true, items: { select: { itemType: true } } } },
        },
      });
      if (!refund) return { duplicate: false, processed: false, missing: true };
      const matches = refund.paymentSession.providerPaymentRequestId === data.payment_request_id
        && refund.amount === data.amount
        && refund.currency === data.currency
        && (!refund.providerRefundId || refund.providerRefundId === data.id);
      const matchesExpectedStatus = (eventType === "refund.succeeded" && data.status === "SUCCEEDED") || (eventType === "refund.failed" && data.status === "FAILED");
      const isValid = matches && matchesExpectedStatus;
      await tx.paymentEvent.create({
        data: {
          provider: "XENDIT",
          providerEventId,
          eventType: eventType ?? "refund.unknown",
          paymentSessionId: refund.paymentSessionId,
          orderId: refund.orderId,
          payload: JSON.parse(rawBody),
          processedAt: isValid ? new Date() : null,
          processingError: isValid ? null : "Refund callback does not match the stored request.",
        },
      });
      if (!isValid) return { duplicate: false, processed: false };
      const nextStatus = eventType === "refund.succeeded" ? "SUCCEEDED" : "FAILED";
      const claimed = await tx.refund.updateMany({
        where: { id: refund.id, status: { in: ["INITIATING", "PENDING"] } },
        data: { providerRefundId: data.id, status: nextStatus, failureCode: data.failure_code ?? null, responseSnapshot: JSON.parse(rawBody) },
      });
      if (claimed.count === 1) {
        if (nextStatus === "SUCCEEDED") await recalculateRefundedOrder(tx, refund.orderId);
        else await restoreResellerCreditsAfterFailedRefund(tx, refund.id);
        await tx.auditLog.create({ data: { organizationId: refund.order.organizationId, action: nextStatus === "SUCCEEDED" ? "payment.refund_succeeded" : "payment.refund_failed", targetType: "Refund", targetId: refund.id, metadata: { orderId: refund.orderId, amount: refund.amount, currency: refund.currency, failureCode: data.failure_code ?? null } } });
      }
      return { duplicate: false, processed: claimed.count === 1 };
    });
    if ("missing" in result && result.missing) return NextResponse.json({ error: "Refund belum ditemukan." }, { status: 404 });
    return NextResponse.json({ received: true, duplicate: result.duplicate, processed: result.processed });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const duplicateEvent = await prisma.paymentEvent.findUnique({ where: { provider_providerEventId: { provider: "XENDIT", providerEventId } }, select: { id: true } });
      if (duplicateEvent) return NextResponse.json({ received: true, duplicate: true });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 256_000) return NextResponse.json({ error: "Payload webhook terlalu besar." }, { status: 413 });
  let payload: XenditSessionWebhook;
  try {
    payload = JSON.parse(rawBody) as XenditSessionWebhook;
  } catch {
    return NextResponse.json({ error: "Payload webhook tidak valid." }, { status: 400 });
  }
  const isRefundEvent = payload.event === "refund.succeeded" || payload.event === "refund.failed";
  const eventType = payload.event ?? "";
  const expectedToken = isRefundEvent ? process.env.XENDIT_REFUND_WEBHOOK_TOKEN : process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expectedToken) return NextResponse.json({ error: "Webhook belum dikonfigurasi." }, { status: 503 });
  const receivedToken = request.headers.get("x-callback-token") ?? "";
  if (!matchesToken(expectedToken, receivedToken)) return NextResponse.json({ error: "Token webhook tidak valid." }, { status: 401 });
  if (isRefundEvent) return processRefundWebhook(payload, rawBody);
  const data = payload.data;
  if (!data?.payment_session_id || !data.reference_id || !["payment_session.completed", "payment_session.expired"].includes(eventType)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const prisma = getPrismaClient();
  const eventId = createHash("sha256").update(rawBody).digest("hex");
  try {
    await prisma.$transaction(async (tx) => {
      const initialPaymentSession = await tx.paymentSession.findUnique({
        where: { providerSessionId: data.payment_session_id },
        include: { order: { include: { items: true, invitation: true, buyer: { select: { name: true, email: true } } } } },
      });
      if (!initialPaymentSession) throw new Error("Sesi pembayaran Xendit belum tersimpan; webhook dapat dicoba ulang.");
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${initialPaymentSession.orderId}::uuid FOR UPDATE`;
      const paymentSession = await tx.paymentSession.findUnique({
        where: { id: initialPaymentSession.id },
        include: { order: { include: { items: true, invitation: true, buyer: { select: { name: true, email: true } } } } },
      });
      if (!paymentSession) throw new Error("Sesi pembayaran Xendit tidak lagi tersedia; webhook dapat dicoba ulang.");
      const isCompleted = eventType === "payment_session.completed";
      const statusMatches = isCompleted ? data.status === "COMPLETED" : data.status === "EXPIRED";
      const amountMatches = data.amount === paymentSession.amountIdr && data.currency === paymentSession.currency;
      const orderMatches = paymentSession.order.id === data.reference_id && paymentSession.order.totalAmount === data.amount;
      await tx.paymentEvent.create({
        data: {
          provider: "XENDIT",
          providerEventId: eventId,
          eventType,
          paymentSessionId: paymentSession.id,
          orderId: paymentSession.orderId,
          payload: JSON.parse(rawBody),
          processedAt: statusMatches && amountMatches && orderMatches ? new Date() : null,
          processingError: !statusMatches || !amountMatches || !orderMatches ? "Webhook session, amount, currency, atau status tidak cocok." : null,
        },
      });
      if (!statusMatches || !amountMatches || !orderMatches) return;
      if (!isCompleted && (paymentSession.status === "SUCCEEDED" || paymentSession.order.status === "PAID")) return;
      if (isCompleted && paymentSession.status === "SUCCEEDED" && paymentSession.order.status === "PAID") return;

      if (isCompleted) {
        const creditItem = paymentSession.order.items.find((item) => item.itemType === "RESELLER_CREDIT");
        if (creditItem) {
          if (paymentSession.order.invitation) throw new Error("Reseller credit order tidak boleh terhubung ke undangan.");
          const itemSnapshot = typeof creditItem.entitlementSnapshot === "object" && creditItem.entitlementSnapshot !== null && !Array.isArray(creditItem.entitlementSnapshot)
            ? creditItem.entitlementSnapshot as Record<string, unknown>
            : {};
          const creditSku = itemSnapshot.creditSku;
          const units = Number(itemSnapshot.units);
          if ((creditSku !== "BASIC_ACTIVATION" && creditSku !== "PREMIUM_ACTIVATION") || !Number.isSafeInteger(units) || units < 1 || units !== creditItem.quantity) {
            throw new Error("Snapshot kredit reseller tidak valid.");
          }
          const reseller = await tx.resellerProfile.findFirst({ where: { organizationId: paymentSession.order.organizationId, status: "APPROVED" }, select: { organizationId: true } });
          if (!reseller) throw new Error("Akun reseller tidak lagi aktif saat pembayaran diterima.");
          await lockResellerCreditBalance(tx, reseller.organizationId);
          const reference = `order:${paymentSession.orderId}:item:${creditItem.id}`;
          await tx.paymentSession.update({ where: { id: paymentSession.id }, data: { status: "SUCCEEDED", providerPaymentId: data.payment_id ?? undefined, providerPaymentRequestId: data.payment_request_id ?? undefined } });
          await tx.order.update({ where: { id: paymentSession.orderId }, data: { status: "PAID", paidAt: new Date() } });
          await tx.creditLedger.upsert({
            where: { resellerOrgId_reference: { resellerOrgId: reseller.organizationId, reference } },
            create: { resellerOrgId: reseller.organizationId, orderId: paymentSession.orderId, sku: creditSku, type: "TOP_UP", unitsDelta: units, reference, metadata: { orderItemId: creditItem.id } },
            update: {},
          });
          await tx.auditLog.create({ data: { organizationId: reseller.organizationId, actorId: paymentSession.order.buyerId, action: "reseller.credit_topped_up", targetType: "Order", targetId: paymentSession.orderId, metadata: { sku: creditSku, units } } });
          const buyerEmail = paymentSession.order.buyer.email;
          if (buyerEmail) {
            await tx.notificationJob.upsert({
              where: { jobKey: `order-paid:${paymentSession.orderId}` },
              create: {
                jobKey: `order-paid:${paymentSession.orderId}`,
                jobType: "ORDER_PAID_EMAIL",
                payload: {
                  to: buyerEmail,
                  name: paymentSession.order.buyer.name ?? "",
                  orderId: paymentSession.orderId,
                  amountIdr: paymentSession.order.totalAmount,
                  currency: "IDR",
                  itemLabel: `${units} kredit ${creditSku === "BASIC_ACTIVATION" ? "Basic" : "Premium"}`,
                  dashboardPath: "/reseller",
                },
              },
              update: {},
            });
          }
          return;
        }
        if (!paymentSession.order.invitation) throw new Error("Payment order tidak terhubung ke undangan.");
        const renewalItem = paymentSession.order.items.find((item) => item.itemType === "RENEWAL");
        if (renewalItem) {
          const renewalSnapshot = typeof renewalItem.entitlementSnapshot === "object" && renewalItem.entitlementSnapshot !== null && !Array.isArray(renewalItem.entitlementSnapshot)
            ? renewalItem.entitlementSnapshot as Record<string, unknown>
            : {};
          const periodDays = Number(renewalSnapshot.periodDays);
          if (!Number.isSafeInteger(periodDays) || periodDays < 30 || periodDays > 3_650 || renewalItem.quantity !== 1 || renewalItem.totalPriceIdr !== paymentSession.order.totalAmount) {
            throw new Error("Snapshot perpanjangan hosting tidak valid.");
          }
          const invitation = paymentSession.order.invitation;
          await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "invitations" WHERE id = ${invitation.id}::uuid FOR UPDATE`;
          const currentInvitation = await tx.invitation.findUnique({ where: { id: invitation.id }, select: { id: true, organizationId: true, status: true, expiresAt: true } });
          if (!currentInvitation) throw new Error("Undangan renewal tidak ditemukan.");
          const paidAt = new Date();
          const periodStartsAt = currentInvitation.expiresAt && currentInvitation.expiresAt > paidAt ? currentInvitation.expiresAt : paidAt;
          const expiresAt = new Date(periodStartsAt.getTime() + periodDays * 86_400_000);
          await tx.paymentSession.update({ where: { id: paymentSession.id }, data: { status: "SUCCEEDED", providerPaymentId: data.payment_id ?? undefined, providerPaymentRequestId: data.payment_request_id ?? undefined } });
          await tx.order.update({ where: { id: paymentSession.orderId }, data: { status: "PAID", paidAt } });
          await tx.entitlement.updateMany({ where: { invitationId: invitation.id, featureKey: "hosting", status: "ACTIVE" }, data: { status: "EXPIRED" } });
          await tx.entitlement.create({ data: { organizationId: invitation.organizationId, invitationId: invitation.id, orderId: paymentSession.orderId, featureKey: "hosting", value: { periodDays, source: "RENEWAL" }, startsAt: periodStartsAt, expiresAt } });
          await tx.invitation.update({ where: { id: invitation.id }, data: { expiresAt, ...(currentInvitation.status === "EXPIRED" ? { status: "PUBLISHED" } : {}) } });
          await tx.auditLog.create({ data: { organizationId: currentInvitation.organizationId, actorId: paymentSession.order.buyerId, action: "invitation.hosting_renewed", targetType: "Invitation", targetId: invitation.id, metadata: { orderId: paymentSession.orderId, previousExpiresAt: currentInvitation.expiresAt?.toISOString() ?? null, expiresAt: expiresAt.toISOString(), periodDays } } });
          const buyerEmail = paymentSession.order.buyer.email;
          if (buyerEmail) {
            await tx.notificationJob.upsert({
              where: { jobKey: `order-paid:${paymentSession.orderId}` },
              create: { jobKey: `order-paid:${paymentSession.orderId}`, jobType: "ORDER_PAID_EMAIL", payload: { to: buyerEmail, name: paymentSession.order.buyer.name ?? "", orderId: paymentSession.orderId, amountIdr: paymentSession.order.totalAmount, currency: "IDR", itemLabel: `Perpanjangan hosting ${periodDays} hari`, dashboardPath: "/dashboard" } },
              update: {},
            });
          }
          return;
        }
        const templateItem = paymentSession.order.items.find((item) => item.itemType === "TEMPLATE_LICENSE");
        const activationItem = paymentSession.order.items.find((item) => item.itemType === "ACTIVATION");
        const publishItem = templateItem ?? activationItem;
        const templateItemCount = paymentSession.order.items.filter((item) => item.itemType === "TEMPLATE_LICENSE").length;
        const activationItemCount = paymentSession.order.items.filter((item) => item.itemType === "ACTIVATION").length;
        const lineItemTotal = paymentSession.order.items.reduce((sum, item) => sum + item.totalPriceIdr, 0);
        const lineItemsAreValid = paymentSession.order.items.length >= 1
          && paymentSession.order.items.length <= 2
          && templateItemCount <= 1
          && activationItemCount <= 1
          && paymentSession.order.items.every((item) =>
            (item.itemType === "TEMPLATE_LICENSE" || item.itemType === "ACTIVATION")
            && item.quantity === 1
            && item.unitPriceIdr > 0
            && item.totalPriceIdr === item.unitPriceIdr * item.quantity,
          )
          && lineItemTotal === paymentSession.order.totalAmount
          && (!templateItem || (Boolean(templateItem.templateId) && Boolean(templateItem.templateVersionId)))
          && (!activationItem || (Boolean(activationItem.templateId) && Boolean(activationItem.templateVersionId)));
        if (!lineItemsAreValid || !publishItem?.templateId || !publishItem.templateVersionId) {
          throw new Error("Payment order tidak memiliki rincian lisensi dan aktivasi yang valid.");
        }
        if (activationItem && (activationItem.templateId !== publishItem.templateId || activationItem.templateVersionId !== publishItem.templateVersionId)) {
          throw new Error("Snapshot aktivasi tidak cocok dengan versi template pada order.");
        }
        const publishSnapshot = typeof publishItem.entitlementSnapshot === "object" && publishItem.entitlementSnapshot !== null && !Array.isArray(publishItem.entitlementSnapshot)
          ? publishItem.entitlementSnapshot as Record<string, unknown>
          : {};
        const expectedLicenseType = templateItem ? "PAID_PER_INVITATION" : "FREE";
        if (publishSnapshot.licenseType !== expectedLicenseType) throw new Error("Snapshot lisensi template tidak cocok dengan order.");
        if (activationItem) {
          const activationSnapshot = typeof activationItem.entitlementSnapshot === "object" && activationItem.entitlementSnapshot !== null && !Array.isArray(activationItem.entitlementSnapshot)
            ? activationItem.entitlementSnapshot as Record<string, unknown>
            : {};
          if (activationSnapshot.licenseType !== expectedLicenseType || activationSnapshot.hostingTermDays !== publishSnapshot.hostingTermDays) {
            throw new Error("Snapshot aktivasi tidak cocok dengan entitlement order.");
          }
        }
        const invitationId = paymentSession.order.invitationId;
        if (!invitationId) throw new Error("Order lisensi template tidak memiliki undangan.");
        await tx.paymentSession.update({
          where: { id: paymentSession.id },
          data: { status: "SUCCEEDED", providerPaymentId: data.payment_id ?? undefined, providerPaymentRequestId: data.payment_request_id ?? undefined },
        });
        await tx.order.update({ where: { id: paymentSession.orderId }, data: { status: "PAID", paidAt: new Date() } });
        const licenseSnapshot = templateItem
          ? JSON.parse(JSON.stringify(templateItem.entitlementSnapshot))
          : {
              licenseType: "FREE",
              templateSlug: publishSnapshot.templateSlug,
              templateVersion: publishSnapshot.templateVersion,
              amountIdr: 0,
            };
        await tx.templateLicense.upsert({
          where: { invitationId_templateVersionId: { invitationId, templateVersionId: publishItem.templateVersionId } },
          create: {
            organizationId: paymentSession.order.organizationId,
            invitationId,
            templateId: publishItem.templateId,
            templateVersionId: publishItem.templateVersionId,
            orderId: paymentSession.orderId,
            ...(templateItem ? { orderItemId: templateItem.id } : {}),
            licenseSnapshot,
          },
          update: {},
        });
        const invitation = paymentSession.order.invitation;
        if (invitation.slug) {
          const latest = await tx.invitationVersion.aggregate({ where: { invitationId: invitation.id }, _max: { version: true } });
          const draftData = typeof invitation.draftData === "object" && invitation.draftData !== null && !Array.isArray(invitation.draftData)
            ? invitation.draftData as Record<string, unknown>
            : {};
          const publishedAt = new Date();
          const nextSlug = typeof draftData.slug === "string" ? draftData.slug : invitation.slug;
          const snapshot = { ...draftData, id: invitation.id, slug: nextSlug, publishedAt: publishedAt.toISOString() };
          const updatedDraft = parseInvitationDraft(snapshot);
          if (!updatedDraft) throw new Error("Paid invitation draft is invalid.");
          const nextTitle = invitationTitle(updatedDraft);
          const periodDays = publishSnapshot.hostingTermDays === undefined ? 365 : Number(publishSnapshot.hostingTermDays);
          if (!Number.isSafeInteger(periodDays) || periodDays < 30 || periodDays > 3_650) throw new Error("Snapshot masa hosting tidak valid.");
          const expiresAt = new Date(publishedAt.getTime() + periodDays * 86_400_000);
          await tx.invitation.update({
            where: { id: invitation.id },
            data: { status: "PUBLISHED", slug: nextSlug, title: nextTitle, startsAt: eventStartsAt(updatedDraft), templateVersionId: publishItem.templateVersionId, publishedAt, expiresAt, publishedSnapshot: snapshot },
          });
          await tx.entitlement.create({ data: { organizationId: invitation.organizationId, invitationId: invitation.id, orderId: paymentSession.orderId, featureKey: "hosting", value: { periodDays, source: "TEMPLATE_CHECKOUT" }, startsAt: publishedAt, expiresAt } });
          const eventData = { title: nextTitle, startsAt: eventStartsAt(updatedDraft), venue: updatedDraft.venue, address: updatedDraft.address, mapsUrl: updatedDraft.mapsUrl || null };
          const events = await tx.event.updateMany({ where: { invitationId: invitation.id }, data: eventData });
          if (events.count === 0) await tx.event.create({ data: { invitationId: invitation.id, ...eventData } });
          await tx.invitationVersion.create({
            data: { invitationId: invitation.id, version: (latest._max.version ?? 0) + 1, type: "PUBLISHED", snapshot, createdById: invitation.ownerId },
          });
          await tx.auditLog.create({ data: { organizationId: invitation.organizationId, actorId: invitation.ownerId, action: "invitation.published_after_payment", targetType: "Invitation", targetId: invitation.id, metadata: { orderId: paymentSession.orderId } } });
        }
        const buyerEmail = paymentSession.order.buyer.email;
        if (buyerEmail) {
          const itemLabel = templateItem && activationItem
            ? "Lisensi template dan aktivasi undangan"
            : activationItem
              ? "Aktivasi undangan"
              : "Lisensi template undangan";
          await tx.notificationJob.upsert({
            where: { jobKey: `order-paid:${paymentSession.orderId}` },
            create: {
              jobKey: `order-paid:${paymentSession.orderId}`,
              jobType: "ORDER_PAID_EMAIL",
              payload: {
                to: buyerEmail,
                name: paymentSession.order.buyer.name ?? "",
                orderId: paymentSession.orderId,
                amountIdr: paymentSession.order.totalAmount,
                currency: "IDR",
                itemLabel,
                dashboardPath: "/dashboard",
              },
            },
            update: {},
          });
        }
      } else {
        await tx.paymentSession.update({ where: { id: paymentSession.id }, data: { status: "EXPIRED" } });
        await tx.order.update({ where: { id: paymentSession.orderId }, data: { status: "EXPIRED" } });
      }
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const duplicateEvent = await prisma.paymentEvent.findUnique({
        where: { provider_providerEventId: { provider: "XENDIT", providerEventId: eventId } },
        select: { id: true },
      });
      if (duplicateEvent) return NextResponse.json({ received: true, duplicate: true });
    }
    throw error;
  }
  return NextResponse.json({ received: true });
}
