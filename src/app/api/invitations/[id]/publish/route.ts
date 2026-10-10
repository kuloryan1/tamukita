import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { randomUUID } from "node:crypto";
import { eventStartsAt, ensureTemplateVersion, invitationTitle, parseInvitationDraft } from "@/lib/invitation-server";
import { getPrismaClient } from "@/lib/prisma";
import { validateInvitationDraft } from "@/lib/validation";
import { isTemplateSelectable } from "@/lib/template-sdk";
import { getCustomerActivationPrice, getHostingTermDays } from "@/lib/platform-settings";
import { buildCustomerCheckoutOrder } from "@/lib/customer-checkout";
import { getXenditApiUrl } from "@/lib/xendit-api";

export const runtime = "nodejs";

class PublishConflict extends Error {}

function isXenditUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["checkout.xendit.co", "checkout-staging.xendit.co", "xen.to", "dev.xen.to"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID undangan tidak valid." }, { status: 400 });
  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: {
      id,
      ownerId: userId,
      deletedAt: null,
      status: { in: ["DRAFT", "PUBLISHED"] },
      organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } },
    },
    include: { owner: { select: { name: true, email: true } } },
  });
  if (!invitation) return NextResponse.json({ error: "Draft tidak ditemukan." }, { status: 404 });
  const draft = parseInvitationDraft({ ...invitation.draftData as object, id: invitation.id, slug: invitation.slug });
  if (!draft) return NextResponse.json({ error: "Data draft perlu diperiksa ulang sebelum diterbitkan." }, { status: 400 });
  const checkedDraft = { ...draft, slug: invitation.slug };
  const validation = validateInvitationDraft(checkedDraft);
  if (!validation.valid) return NextResponse.json({ error: validation.message ?? "Detail undangan belum lengkap." }, { status: 400 });

  const template = await ensureTemplateVersion(checkedDraft.templateId);
  if (!template) return NextResponse.json({ error: "Template tidak tersedia." }, { status: 400 });
  const existingLicense = await prisma.templateLicense.findFirst({
    where: { invitationId: invitation.id, templateVersionId: template.version.id },
    select: { id: true },
  });
  if (!isTemplateSelectable(template.template.status) && !existingLicense) return NextResponse.json({ error: "Template ini sudah tidak menerima publikasi baru. Hubungi admin jika undanganmu memiliki lisensi." }, { status: 409 });
  const publishedAt = new Date();
  const hostingTermDays = existingLicense ? null : await getHostingTermDays();
  if (existingLicense) {
    try {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.invitation.updateMany({
          where: { id, ownerId: userId, status: invitation.status, deletedAt: null, organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } },
          data: { status: "PUBLISHED", slug: checkedDraft.slug, title: invitationTitle(checkedDraft), publishedAt, publishedSnapshot: JSON.parse(JSON.stringify({ ...checkedDraft, publishedAt: publishedAt.toISOString() })), templateVersionId: template.version.id, startsAt: eventStartsAt(checkedDraft) },
        });
        if (claimed.count !== 1) throw new PublishConflict();
        const latest = await tx.invitationVersion.aggregate({ where: { invitationId: id }, _max: { version: true } });
        const snapshot = { ...checkedDraft, publishedAt: publishedAt.toISOString() };
        await tx.invitationVersion.create({
          data: { invitationId: id, version: (latest._max.version ?? 0) + 1, type: "PUBLISHED", snapshot: JSON.parse(JSON.stringify(snapshot)), createdById: userId },
        });
        const eventData = { title: invitationTitle(checkedDraft), startsAt: eventStartsAt(checkedDraft), venue: checkedDraft.venue, address: checkedDraft.address, mapsUrl: checkedDraft.mapsUrl || null };
        const events = await tx.event.updateMany({ where: { invitationId: id }, data: eventData });
        if (events.count === 0) await tx.event.create({ data: { invitationId: id, ...eventData } });
        await tx.auditLog.create({ data: { organizationId: invitation.organizationId, actorId: userId, action: "invitation.published", targetType: "Invitation", targetId: id } });
      });
    } catch (error) {
      if (error instanceof PublishConflict) return NextResponse.json({ error: "Status undangan berubah. Muat ulang halaman dan periksa kembali." }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ published: true, slug: invitation.slug });
  }

  if (hostingTermDays === null) return NextResponse.json({ error: "Masa hosting belum dapat ditentukan." }, { status: 503 });

  const customerActivationPriceIdr = await getCustomerActivationPrice();
  if (template.template.licenseType === "FREE" && template.template.priceIdr !== 0) return NextResponse.json({ error: "Harga lisensi gratis harus Rp0. Hubungi admin untuk memperbaiki katalog." }, { status: 409 });
  if (template.template.licenseType === "PAID_PER_INVITATION" && template.template.priceIdr <= 0) return NextResponse.json({ error: "Harga lisensi template tidak valid." }, { status: 409 });

  if (template.template.licenseType === "FREE" && customerActivationPriceIdr === 0) {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "invitations" WHERE id = ${invitation.id}::uuid FOR UPDATE`;
        const current = await tx.invitation.findFirst({
          where: { id: invitation.id, ownerId: userId, deletedAt: null, status: invitation.status, organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } },
          select: { id: true },
        });
        if (!current) throw new PublishConflict();
        const snapshot = { ...checkedDraft, publishedAt: publishedAt.toISOString() };
        await tx.templateLicense.create({
          data: {
            organizationId: invitation.organizationId,
            invitationId: invitation.id,
            templateId: template.template.id,
            templateVersionId: template.version.id,
            licenseSnapshot: { licenseType: "FREE", templateSlug: template.template.slug, templateVersion: template.version.version, amountIdr: 0 },
          },
        });
        const claimed = await tx.invitation.updateMany({
          where: { id: invitation.id, ownerId: userId, status: invitation.status, deletedAt: null, organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } },
          data: { status: "PUBLISHED", title: invitationTitle(checkedDraft), publishedAt, publishedSnapshot: JSON.parse(JSON.stringify(snapshot)), templateVersionId: template.version.id, startsAt: eventStartsAt(checkedDraft), expiresAt: new Date(publishedAt.getTime() + hostingTermDays * 86_400_000) },
        });
        if (claimed.count !== 1) throw new PublishConflict();
        const expiresAt = new Date(publishedAt.getTime() + hostingTermDays * 86_400_000);
        await tx.entitlement.create({ data: { organizationId: invitation.organizationId, invitationId: invitation.id, featureKey: "hosting", value: { periodDays: hostingTermDays, source: "FREE_TEMPLATE" }, startsAt: publishedAt, expiresAt } });
        const latest = await tx.invitationVersion.aggregate({ where: { invitationId: invitation.id }, _max: { version: true } });
        await tx.invitationVersion.create({
          data: { invitationId: invitation.id, version: (latest._max.version ?? 0) + 1, type: "PUBLISHED", snapshot: JSON.parse(JSON.stringify(snapshot)), createdById: userId },
        });
        const eventData = { title: invitationTitle(checkedDraft), startsAt: eventStartsAt(checkedDraft), venue: checkedDraft.venue, address: checkedDraft.address, mapsUrl: checkedDraft.mapsUrl || null };
        const events = await tx.event.updateMany({ where: { invitationId: invitation.id }, data: eventData });
        if (events.count === 0) await tx.event.create({ data: { invitationId: invitation.id, ...eventData } });
        await tx.auditLog.create({ data: { organizationId: invitation.organizationId, actorId: userId, action: "invitation.published_free_template", targetType: "Invitation", targetId: invitation.id, metadata: { templateId: template.template.id, templateVersionId: template.version.id } } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof PublishConflict) return NextResponse.json({ error: "Status undangan berubah. Muat ulang halaman dan periksa kembali." }, { status: 409 });
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Lisensi template sudah diproses. Muat ulang status undangan." }, { status: 409 });
      throw error;
    }
    return NextResponse.json({ published: true, slug: invitation.slug, free: true });
  }

  const activeSession = await prisma.paymentSession.findFirst({
    where: { order: { invitationId: invitation.id, status: "PENDING" }, status: "PENDING", expiresAt: { gt: new Date() }, checkoutUrl: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { checkoutUrl: true },
  });
  if (activeSession?.checkoutUrl) return NextResponse.json({ checkoutUrl: activeSession.checkoutUrl });

  const secret = process.env.XENDIT_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Pembayaran belum dikonfigurasi di server." }, { status: 503 });
  const customerOrder = buildCustomerCheckoutOrder({
    template: {
      id: template.template.id,
      versionId: template.version.id,
      slug: template.template.slug,
      version: template.version.version,
      licenseType: template.template.licenseType,
      priceIdr: template.template.priceIdr,
      features: template.templateData.features,
    },
    activationPriceIdr: customerActivationPriceIdr,
    hostingTermDays,
  });
  if (!customerOrder || customerOrder.totalAmountIdr <= 0 || customerOrder.items.length === 0) return NextResponse.json({ error: "Harga checkout undangan tidak valid. Hubungi admin." }, { status: 409 });

  const orderResult = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "invitations" WHERE id = ${invitation.id}::uuid FOR UPDATE`;
      const current = await tx.invitation.findFirst({
        where: { id: invitation.id, ownerId: userId, deletedAt: null, status: "DRAFT", organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } },
        select: { id: true },
      });
      if (!current) throw new PublishConflict();
      const pendingOrder = await tx.order.findFirst({
        where: { invitationId: invitation.id, status: "PENDING", paymentSessions: { some: { status: { in: ["CREATED", "PENDING"] } } } },
        orderBy: { createdAt: "desc" },
        include: { paymentSessions: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      const pendingSession = pendingOrder?.paymentSessions[0];
      if (pendingSession) {
        if (pendingSession.status === "PENDING" && pendingSession.checkoutUrl && pendingSession.expiresAt && pendingSession.expiresAt > new Date()) {
          return { kind: "checkout" as const, checkoutUrl: pendingSession.checkoutUrl };
        }
        throw new PublishConflict();
      }
      const order = await tx.order.create({
        data: {
          organizationId: invitation.organizationId,
          buyerId: userId,
          invitationId: invitation.id,
          status: "PENDING",
          currency: "IDR",
          totalAmount: customerOrder.totalAmountIdr,
          idempotencyKey: randomUUID(),
          priceSnapshot: {
            templateSlug: template.template.slug,
            templateVersion: template.version.version,
            templatePriceIdr: template.template.priceIdr,
            activationPriceIdr: customerActivationPriceIdr,
            amountIdr: customerOrder.totalAmountIdr,
            hostingTermDays,
          },
          items: {
            create: customerOrder.items,
          },
          paymentSessions: { create: [{ amountIdr: customerOrder.totalAmountIdr, currency: "IDR", status: "CREATED", requestSnapshot: { flow: "PAYMENT_LINK", sessionType: "PAY" } }] },
        },
        include: { paymentSessions: true, items: true },
      });
      return { kind: "order" as const, order };
  }).catch((error) => {
    if (error instanceof PublishConflict) return null;
    throw error;
  });
  if (!orderResult) return NextResponse.json({ error: "Undangan sedang dibayar atau statusnya berubah. Periksa status pembayaran sebelum mencoba lagi." }, { status: 409 });
  if (orderResult.kind === "checkout") return NextResponse.json({ checkoutUrl: orderResult.checkoutUrl });
  const order = orderResult.order;
  const paymentSession = order.paymentSessions[0];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const successUrl = new URL("/dashboard/checkout/return", baseUrl);
  successUrl.searchParams.set("invitationId", id);
  const cancelUrl = new URL("/dashboard/checkout/return", baseUrl);
  cancelUrl.searchParams.set("invitationId", id);
  cancelUrl.searchParams.set("payment", "cancelled");
  const callbackUrls = new URL(baseUrl).protocol === "https:" ? {
    success_return_url: successUrl.toString(),
    cancel_return_url: cancelUrl.toString(),
  } : {};
  const givenNames = (invitation.owner.name || "TamuKita").replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/)[0] || "TamuKita";
  const surname = (invitation.owner.name || "").replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/).slice(1).join(" ");
  const requestBody = {
    reference_id: order.id,
    session_type: "PAY",
    mode: "PAYMENT_LINK",
    amount: order.totalAmount,
    currency: "IDR",
    country: "ID",
    locale: "id",
    capture_method: "AUTOMATIC",
    customer: {
      reference_id: `customer${userId.replaceAll("-", "")}`,
      type: "INDIVIDUAL",
      ...(invitation.owner.email ? { email: invitation.owner.email.slice(0, 50) } : {}),
      individual_detail: { given_names: givenNames, ...(surname ? { surname } : {}) },
    },
    description: `Lisensi template ${template.template.name} untuk undangan ${invitation.slug}`,
    items: order.items.map((item) => ({
      reference_id: item.id,
      type: "DIGITAL_PRODUCT",
      name: item.itemType === "TEMPLATE_LICENSE" ? `Lisensi ${template.template.name}` : "Aktivasi undangan",
      category: "Undangan digital",
      net_unit_amount: item.unitPriceIdr,
      quantity: item.quantity,
      currency: "IDR",
    })),
    ...callbackUrls,
  };

  let providerResponse: Response;
  try {
    providerResponse = await fetch(getXenditApiUrl("sessions"), {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    await prisma.paymentSession.update({ where: { id: paymentSession.id }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "Xendit tidak dapat dihubungi. Coba buat sesi pembayaran baru." }, { status: 502 });
  }
  const responseBody = await providerResponse.json().catch(() => null) as { payment_session_id?: string; payment_link_url?: string | null; expires_at?: string; payment_id?: string | null; payment_request_id?: string | null } | null;
  if (!providerResponse.ok || !responseBody?.payment_session_id || !responseBody.payment_link_url || !isXenditUrl(responseBody.payment_link_url)) {
    await prisma.paymentSession.update({ where: { id: paymentSession.id }, data: { status: "FAILED", responseSnapshot: { httpStatus: providerResponse.status } } });
    return NextResponse.json({ error: "Xendit belum dapat membuat tautan pembayaran. Coba lagi nanti." }, { status: 502 });
  }
  await prisma.paymentSession.update({
    where: { id: paymentSession.id },
    data: {
      providerSessionId: responseBody.payment_session_id,
      providerPaymentId: responseBody.payment_id ?? undefined,
      providerPaymentRequestId: responseBody.payment_request_id ?? undefined,
      checkoutUrl: responseBody.payment_link_url,
      status: "PENDING",
      expiresAt: responseBody.expires_at ? new Date(responseBody.expires_at) : new Date(Date.now() + 30 * 60 * 1000),
      requestSnapshot: JSON.parse(JSON.stringify(requestBody)),
      responseSnapshot: JSON.parse(JSON.stringify(responseBody)),
    },
  });
  return NextResponse.json({ checkoutUrl: responseBody.payment_link_url });
}
