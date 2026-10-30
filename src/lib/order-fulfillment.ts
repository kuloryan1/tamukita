import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { isCustomerPlanSnapshot } from "@/lib/customer-checkout";
import { legacyInvitationFeatureAccess, resolveInvitationFeatureAccess, validateDraftFeatureAccess } from "@/lib/invitation-features";
import { eventStartsAt, invitationTitle, parseInvitationDraft } from "@/lib/invitation-server";
import { validateInvitationDraft, validateTemplateFields } from "@/lib/validation";
import { isEditorCompatibleTemplate, validateTemplateManifest } from "@/lib/template-sdk";
import { lockResellerCreditBalance } from "@/lib/reseller-credits";

export const paidSessionInclude = {
  order: { include: { items: true, invitation: true, buyer: { select: { name: true, email: true } } } },
} as const;

type PaidSession = Prisma.PaymentSessionGetPayload<{ include: typeof paidSessionInclude }>;

// Call inside a transaction after locking and re-reading the order.
export async function fulfillPaidOrder(tx: Prisma.TransactionClient, paymentSession: PaidSession, references: { paymentId?: string | null; paymentRequestId?: string | null } = {}) {
  if (paymentSession.status === "SUCCEEDED" && ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"].includes(paymentSession.order.status)) return;
  const order = paymentSession.order;
  if (order.currency !== "IDR" || paymentSession.currency !== "IDR" || order.totalAmount <= 0
    || paymentSession.amountIdr !== order.totalAmount
    || order.items.reduce((sum, item) => sum + item.totalPriceIdr, 0) !== order.totalAmount
    || order.items.some((item) => item.quantity < 1 || item.unitPriceIdr <= 0 || item.totalPriceIdr !== item.quantity * item.unitPriceIdr)) {
    throw new Error("Rincian pembayaran tidak cocok dengan order.");
  }
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
    await tx.paymentSession.update({ where: { id: paymentSession.id }, data: { status: "SUCCEEDED", providerPaymentId: references.paymentId ?? undefined, providerPaymentRequestId: references.paymentRequestId ?? undefined } });
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
    const currentPlanHosting = await tx.entitlement.findFirst({
      where: { invitationId: invitation.id, featureKey: "hosting", planId: { not: null }, status: "ACTIVE" },
      orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
      select: { planId: true },
    });
    const paidAt = new Date();
    const periodStartsAt = currentInvitation.expiresAt && currentInvitation.expiresAt > paidAt ? currentInvitation.expiresAt : paidAt;
    const expiresAt = new Date(periodStartsAt.getTime() + periodDays * 86_400_000);
    await tx.paymentSession.update({ where: { id: paymentSession.id }, data: { status: "SUCCEEDED", providerPaymentId: references.paymentId ?? undefined, providerPaymentRequestId: references.paymentRequestId ?? undefined } });
    await tx.order.update({ where: { id: paymentSession.orderId }, data: { status: "PAID", paidAt } });
    await tx.entitlement.updateMany({ where: { invitationId: invitation.id, featureKey: "hosting", status: "ACTIVE" }, data: { status: "EXPIRED" } });
    await tx.entitlement.create({ data: { organizationId: invitation.organizationId, invitationId: invitation.id, ...(currentPlanHosting?.planId ? { planId: currentPlanHosting.planId } : {}), orderId: paymentSession.orderId, featureKey: "hosting", value: { periodDays, source: "RENEWAL" }, startsAt: periodStartsAt, expiresAt } });
    if (currentPlanHosting?.planId) {
      await tx.entitlement.updateMany({
        where: { invitationId: invitation.id, planId: currentPlanHosting.planId, featureKey: { not: "hosting" }, status: "ACTIVE" },
        data: { expiresAt },
      });
    }
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
  const hasPlanSnapshot = Object.hasOwn(publishSnapshot, "plan");
  const planSnapshot = publishSnapshot.plan;
  if (hasPlanSnapshot && !isCustomerPlanSnapshot(planSnapshot)) throw new Error("Snapshot paket pada order tidak valid.");
  const expectedLicenseType = templateItem ? "PAID_PER_INVITATION" : "FREE";
  if (publishSnapshot.licenseType !== expectedLicenseType) throw new Error("Snapshot lisensi template tidak cocok dengan order.");
  if (activationItem) {
    const activationSnapshot = typeof activationItem.entitlementSnapshot === "object" && activationItem.entitlementSnapshot !== null && !Array.isArray(activationItem.entitlementSnapshot)
      ? activationItem.entitlementSnapshot as Record<string, unknown>
      : {};
    if (activationSnapshot.licenseType !== expectedLicenseType || activationSnapshot.hostingTermDays !== publishSnapshot.hostingTermDays) {
      throw new Error("Snapshot aktivasi tidak cocok dengan entitlement order.");
    }
    if (Object.hasOwn(activationSnapshot, "plan") !== hasPlanSnapshot || (hasPlanSnapshot && JSON.stringify(activationSnapshot.plan) !== JSON.stringify(planSnapshot))) {
      throw new Error("Snapshot paket pada item aktivasi tidak cocok dengan order.");
    }
  }
  if (hasPlanSnapshot) {
    const plan = planSnapshot as NonNullable<typeof planSnapshot> & { durationDays: number; priceIdr: number };
    if (plan.durationDays !== publishSnapshot.hostingTermDays || (activationItem ? activationItem.totalPriceIdr !== plan.priceIdr : plan.priceIdr !== 0)) {
      throw new Error("Harga atau masa paket tidak cocok dengan order.");
    }
  }
  const invitationId = paymentSession.order.invitationId;
  if (!invitationId) throw new Error("Order lisensi template tidak memiliki undangan.");
  await tx.paymentSession.update({
    where: { id: paymentSession.id },
    data: { status: "SUCCEEDED", providerPaymentId: references.paymentId ?? undefined, providerPaymentRequestId: references.paymentRequestId ?? undefined },
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
  let published = false;
  if (invitation.slug) {
    const draftData = typeof invitation.draftData === "object" && invitation.draftData !== null && !Array.isArray(invitation.draftData)
      ? invitation.draftData as Record<string, unknown>
      : {};
    const publishedAt = new Date();
    const nextSlug = typeof draftData.slug === "string" ? draftData.slug : invitation.slug;
    const snapshot = { ...draftData, id: invitation.id, slug: nextSlug, publishedAt: publishedAt.toISOString() };
    const updatedDraft = parseInvitationDraft(snapshot);
    if (!updatedDraft) throw new Error("Paid invitation draft is invalid.");
    const nextTitle = invitationTitle(updatedDraft);
    const contentValidation = validateInvitationDraft(updatedDraft);
    const version = await tx.templateVersion.findUnique({
      where: { id: publishItem.templateVersionId },
      select: { version: true, manifest: true, template: { select: { slug: true } } },
    });
    const manifest = version ? validateTemplateManifest(version.manifest) : null;
    const templateFieldsValid = Boolean(
      manifest?.success
      && version
            && updatedDraft.templateId === version.template.slug
      && manifest.data.slug === version.template.slug
      && manifest.data.version === version.version
      && isEditorCompatibleTemplate(manifest.data)
      && validateTemplateFields(updatedDraft, manifest.data).valid,
    );
    const featureAccess = hasPlanSnapshot
      ? resolveInvitationFeatureAccess((planSnapshot as { entitlements: Array<{ featureKey: string; value: unknown }> }).entitlements)
      : legacyInvitationFeatureAccess;
    published = contentValidation.valid && templateFieldsValid && !validateDraftFeatureAccess(updatedDraft, featureAccess);
    const periodDays = publishSnapshot.hostingTermDays === undefined ? 365 : Number(publishSnapshot.hostingTermDays);
    if (!Number.isSafeInteger(periodDays) || periodDays < (hasPlanSnapshot ? 1 : 30) || periodDays > 3_650) throw new Error("Snapshot masa hosting tidak valid.");
    const expiresAt = new Date(publishedAt.getTime() + periodDays * 86_400_000);
    await tx.invitation.update({
      where: { id: invitation.id },
      data: published
        ? { status: "PUBLISHED", slug: nextSlug, title: nextTitle, startsAt: eventStartsAt(updatedDraft), templateVersionId: publishItem.templateVersionId, publishedAt, formCompletedAt: invitation.formCompletedAt ?? publishedAt, expiresAt, publishedSnapshot: snapshot }
        : { title: nextTitle, templateVersionId: publishItem.templateVersionId, expiresAt },
    });
    await tx.entitlement.create({ data: { organizationId: invitation.organizationId, invitationId: invitation.id, ...(hasPlanSnapshot ? { planId: (planSnapshot as { id: string }).id } : {}), orderId: paymentSession.orderId, featureKey: "hosting", value: { periodDays, source: hasPlanSnapshot ? "PLAN_ACTIVATION" : "TEMPLATE_CHECKOUT" }, startsAt: publishedAt, expiresAt } });
    if (hasPlanSnapshot) {
      const plan = planSnapshot as { id: string; entitlements: Array<{ featureKey: string; value: unknown }> };
      if (plan.entitlements.length) {
        await tx.entitlement.createMany({
          data: plan.entitlements.map(({ featureKey, value }) => ({
            organizationId: invitation.organizationId,
            invitationId: invitation.id,
            planId: plan.id,
            orderId: paymentSession.orderId,
            featureKey,
            value: value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue,
            startsAt: publishedAt,
            expiresAt,
          })),
        });
      }
    }
    if (published) {
      const latest = await tx.invitationVersion.aggregate({ where: { invitationId: invitation.id }, _max: { version: true } });
      const eventData = { title: nextTitle, startsAt: eventStartsAt(updatedDraft), venue: updatedDraft.venue, address: updatedDraft.address, mapsUrl: updatedDraft.mapsUrl || null };
      const events = await tx.event.updateMany({ where: { invitationId: invitation.id }, data: eventData });
      if (events.count === 0) await tx.event.create({ data: { invitationId: invitation.id, ...eventData } });
      await tx.invitationVersion.create({
        data: { invitationId: invitation.id, version: (latest._max.version ?? 0) + 1, type: "PUBLISHED", snapshot, createdById: invitation.ownerId },
      });
      await tx.auditLog.create({ data: { organizationId: invitation.organizationId, actorId: invitation.ownerId, action: "invitation.published_after_payment", targetType: "Invitation", targetId: invitation.id, metadata: { orderId: paymentSession.orderId } } });
    } else {
      await tx.auditLog.create({ data: { organizationId: invitation.organizationId, actorId: invitation.ownerId, action: "invitation.payment_received_draft_incomplete", targetType: "Invitation", targetId: invitation.id, metadata: { orderId: paymentSession.orderId } } });
    }
  }
  const buyerEmail = paymentSession.order.buyer.email;
  if (buyerEmail) {
    const purchasedItemsLabel = templateItem && activationItem
      ? "Lisensi template dan aktivasi undangan"
      : activationItem
        ? "Aktivasi undangan"
        : "Lisensi template undangan";
    const itemLabel = published ? purchasedItemsLabel : `${purchasedItemsLabel}; lengkapi detail sesuai paket sebelum terbit`;
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
          dashboardPath: published ? "/dashboard" : `/dashboard/invitations/${invitation.id}/edit`,
        },
      },
      update: {},
    });
  }
}
