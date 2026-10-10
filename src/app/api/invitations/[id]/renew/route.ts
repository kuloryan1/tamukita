import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { getHostingRenewalPrice, getHostingTermDays } from "@/lib/platform-settings";
import { getXenditApiUrl } from "@/lib/xendit-api";

export const runtime = "nodejs";

class RenewalConflict extends Error {}

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
  if (!await allowRequest(`invitation:renew:${userId}`, 15, 60 * 60)) return NextResponse.json({ error: "Terlalu banyak percobaan perpanjangan. Coba lagi nanti." }, { status: 429 });

  const prisma = getPrismaClient();
  const [invitation, amountIdr, periodDays] = await Promise.all([
    prisma.invitation.findFirst({
      where: { id, ownerId: userId, deletedAt: null, status: { in: ["PUBLISHED", "EXPIRED"] }, organization: { status: "ACTIVE", memberships: { some: { userId, role: "OWNER" } } } },
      select: { id: true, organizationId: true, slug: true, title: true, status: true, expiresAt: true, owner: { select: { name: true, email: true } } },
    }),
    getHostingRenewalPrice(),
    getHostingTermDays(),
  ]);
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan atau tidak dapat diperpanjang oleh akun ini." }, { status: 404 });
  if (!invitation.expiresAt) return NextResponse.json({ error: "Undangan ini belum memiliki masa hosting yang dapat diperpanjang." }, { status: 409 });
  const validLicense = await prisma.templateLicense.findFirst({
    where: { invitationId: invitation.id, OR: [{ orderId: null }, { order: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] } } }] },
    select: { id: true },
  });
  if (!validLicense) return NextResponse.json({ error: "Lisensi template untuk undangan ini tidak aktif sehingga hosting tidak dapat diperpanjang." }, { status: 409 });
  if (!amountIdr) return NextResponse.json({ error: "Harga renewal belum diaktifkan oleh admin." }, { status: 503 });
  const renewalWindowStartsAt = new Date(Date.now() + 30 * 86_400_000);
  if (invitation.expiresAt > renewalWindowStartsAt) return NextResponse.json({ error: "Perpanjangan dapat dilakukan dalam 30 hari sebelum masa hosting berakhir." }, { status: 409 });

  const secret = process.env.XENDIT_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Pembayaran belum dikonfigurasi di server." }, { status: 503 });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const successUrl = new URL("/dashboard/checkout/return", baseUrl);
  successUrl.searchParams.set("invitationId", invitation.id);
  successUrl.searchParams.set("renewal", "1");
  const cancelUrl = new URL(successUrl);
  cancelUrl.searchParams.set("payment", "cancelled");
  const callbackUrls = new URL(baseUrl).protocol === "https:" ? { success_return_url: successUrl.toString(), cancel_return_url: cancelUrl.toString() } : {};
  const name = (invitation.owner.name || "TamuKita").replace(/[^a-zA-Z0-9 ]/g, " ").trim();
  const givenNames = name.split(/\s+/)[0] || "TamuKita";
  const surname = name.split(/\s+/).slice(1).join(" ");

  let orderResult: { kind: "checkout"; checkoutUrl: string } | { kind: "order"; order: Awaited<ReturnType<typeof prisma.order.create>> & { items: { id: string }[]; paymentSessions: { id: string }[] } };
  try {
    orderResult = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "invitations" WHERE id = ${invitation.id}::uuid FOR UPDATE`;
      const current = await tx.invitation.findFirst({
        where: { id: invitation.id, ownerId: userId, deletedAt: null, status: { in: ["PUBLISHED", "EXPIRED"] }, organization: { status: "ACTIVE", memberships: { some: { userId, role: "OWNER" } } } },
        select: { id: true, expiresAt: true },
      });
      if (!current?.expiresAt || current.expiresAt > renewalWindowStartsAt) throw new RenewalConflict();
      const currentLicense = await tx.templateLicense.findFirst({
        where: { invitationId: invitation.id, OR: [{ orderId: null }, { order: { status: { in: ["PAID", "PARTIALLY_REFUNDED"] } } }] },
        select: { id: true },
      });
      if (!currentLicense) throw new RenewalConflict();

      const pending = await tx.order.findFirst({
        where: { invitationId: invitation.id, status: "PENDING", items: { some: { itemType: "RENEWAL" } }, paymentSessions: { some: { status: { in: ["CREATED", "PENDING"] } } } },
        orderBy: { createdAt: "desc" },
        include: { paymentSessions: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      const pendingSession = pending?.paymentSessions[0];
      if (pendingSession) {
        if (pendingSession.status === "PENDING" && pendingSession.checkoutUrl && pendingSession.expiresAt && pendingSession.expiresAt > new Date()) return { kind: "checkout" as const, checkoutUrl: pendingSession.checkoutUrl };
        throw new RenewalConflict();
      }

      const order = await tx.order.create({
        data: {
          organizationId: invitation.organizationId,
          buyerId: userId,
          invitationId: invitation.id,
          status: "PENDING",
          currency: "IDR",
          totalAmount: amountIdr,
          idempotencyKey: randomUUID(),
          priceSnapshot: { flow: "INVITATION_HOSTING_RENEWAL", amountIdr, periodDays, previousExpiresAt: current.expiresAt.toISOString() },
          items: { create: [{ itemType: "RENEWAL", sku: `hosting-renewal:${periodDays}d`, quantity: 1, unitPriceIdr: amountIdr, totalPriceIdr: amountIdr, entitlementSnapshot: { periodDays, previousExpiresAt: current.expiresAt.toISOString() } }] },
          paymentSessions: { create: [{ amountIdr, currency: "IDR", status: "CREATED", requestSnapshot: { flow: "INVITATION_HOSTING_RENEWAL", sessionType: "PAY" } }] },
        },
        include: { items: true, paymentSessions: true },
      });
      return { kind: "order" as const, order };
    });
  } catch (error) {
    if (error instanceof RenewalConflict) return NextResponse.json({ error: "Ada pembayaran renewal yang masih diproses atau masa aktif berubah. Periksa kembali status pembayaran." }, { status: 409 });
    throw error;
  }
  if (orderResult.kind === "checkout") return NextResponse.json({ checkoutUrl: orderResult.checkoutUrl });
  const order = orderResult.order;
  const paymentSession = order.paymentSessions[0];
  const requestBody = {
    reference_id: order.id,
    session_type: "PAY",
    mode: "PAYMENT_LINK",
    amount: amountIdr,
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
    description: `Perpanjangan hosting ${invitation.slug}`,
    items: [{ reference_id: order.items[0].id, type: "DIGITAL_PRODUCT", name: `Hosting undangan ${periodDays} hari`, category: "Undangan digital", net_unit_amount: amountIdr, quantity: 1, currency: "IDR" }],
    ...callbackUrls,
  };

  let response: Response;
  try {
    response = await fetch(getXenditApiUrl("sessions"), {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`, "content-type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    await prisma.paymentSession.update({ where: { id: paymentSession.id }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "Xendit tidak dapat dihubungi. Coba buat sesi renewal baru." }, { status: 502 });
  }
  const responseBody = await response.json().catch(() => null) as { payment_session_id?: string; payment_link_url?: string | null; expires_at?: string; payment_id?: string | null; payment_request_id?: string | null } | null;
  if (!response.ok || !responseBody?.payment_session_id || !responseBody.payment_link_url || !isXenditUrl(responseBody.payment_link_url)) {
    await prisma.paymentSession.update({ where: { id: paymentSession.id }, data: { status: "FAILED", responseSnapshot: { httpStatus: response.status } } });
    return NextResponse.json({ error: "Xendit belum dapat membuat tautan renewal. Coba lagi nanti." }, { status: 502 });
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
