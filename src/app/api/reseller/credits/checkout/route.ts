import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { getResellerCreditPrice } from "@/lib/platform-settings";
import { getXenditApiUrl } from "@/lib/xendit-api";

export const runtime = "nodejs";

const checkoutSchema = z.object({ sku: z.enum(["BASIC_ACTIVATION", "PREMIUM_ACTIVATION"]), quantity: z.number().int().min(1).max(100) });

function isXenditUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && ["checkout.xendit.co", "checkout-staging.xendit.co", "xen.to", "dev.xen.to"].includes(url.hostname);
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Pilihan kredit tidak valid." }, { status: body.status });
  const parsed = checkoutSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih paket dan jumlah kredit dengan benar." }, { status: 400 });
  if (!await allowRequest(`reseller:checkout:${userId}`, 5, 60 * 60)) return NextResponse.json({ error: "Terlalu banyak percobaan checkout. Coba lagi nanti." }, { status: 429 });

  const unitPrice = await getResellerCreditPrice(parsed.data.sku);
  if (!unitPrice) return NextResponse.json({ error: "Harga kredit reseller belum dikonfigurasi." }, { status: 503 });
  const secret = process.env.XENDIT_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Pembayaran belum dikonfigurasi di server." }, { status: 503 });

  const prisma = getPrismaClient();
  const profile = await prisma.resellerProfile.findFirst({
    where: { status: "APPROVED", organization: { type: "RESELLER", status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN"] } } } } },
    select: { organizationId: true, businessName: true },
  });
  if (!profile) return NextResponse.json({ error: "Akun reseller belum disetujui." }, { status: 403 });

  const totalAmount = unitPrice * parsed.data.quantity;
  if (!Number.isSafeInteger(totalAmount) || totalAmount > 2_147_483_647) return NextResponse.json({ error: "Jumlah pembayaran terlalu besar." }, { status: 400 });
  const order = await prisma.order.create({
    data: {
      organizationId: profile.organizationId,
      buyerId: userId,
      status: "PENDING",
      currency: "IDR",
      totalAmount,
      idempotencyKey: randomUUID(),
      priceSnapshot: { creditSku: parsed.data.sku, units: parsed.data.quantity, unitPriceIdr: unitPrice },
      items: { create: [{ itemType: "RESELLER_CREDIT", sku: `credit:${parsed.data.sku}`, quantity: parsed.data.quantity, unitPriceIdr: unitPrice, totalPriceIdr: totalAmount, entitlementSnapshot: { creditSku: parsed.data.sku, units: parsed.data.quantity } }] },
      paymentSessions: { create: [{ amountIdr: totalAmount, currency: "IDR", status: "CREATED", requestSnapshot: { flow: "RESELLER_CREDIT_TOP_UP", sessionType: "PAY" } }] },
    },
    include: { paymentSessions: true, items: true },
  });
  const paymentSession = order.paymentSessions[0];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const successUrl = new URL("/reseller", baseUrl);
  successUrl.searchParams.set("payment", "return");
  const cancelUrl = new URL("/reseller", baseUrl);
  cancelUrl.searchParams.set("payment", "cancelled");
  const callbackUrls = new URL(baseUrl).protocol === "https:" ? { success_return_url: successUrl.toString(), cancel_return_url: cancelUrl.toString() } : {};
  const givenName = (session.user?.name || "TamuKita").replace(/[^a-zA-Z0-9 ]/g, " ").trim().split(/\s+/)[0] || "TamuKita";
  const requestBody = {
    reference_id: order.id,
    session_type: "PAY",
    mode: "PAYMENT_LINK",
    amount: totalAmount,
    currency: "IDR",
    country: "ID",
    locale: "id",
    capture_method: "AUTOMATIC",
    customer: {
      reference_id: `customer${userId.replaceAll("-", "")}`,
      type: "INDIVIDUAL",
      ...(session.user?.email ? { email: session.user.email.slice(0, 50) } : {}),
      individual_detail: { given_names: givenName },
    },
    description: `Top up ${parsed.data.quantity} kredit ${parsed.data.sku} untuk ${profile.businessName}`,
    items: [{ reference_id: order.items[0].id, type: "DIGITAL_PRODUCT", name: `${parsed.data.quantity} kredit aktivasi ${parsed.data.sku}`, category: "Kredit reseller", net_unit_amount: unitPrice, quantity: parsed.data.quantity, currency: "IDR" }],
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
    await prisma.$transaction([
      prisma.paymentSession.update({ where: { id: paymentSession.id }, data: { status: "FAILED" } }),
      prisma.order.update({ where: { id: order.id }, data: { status: "CANCELED", canceledAt: new Date() } }),
    ]);
    return NextResponse.json({ error: "Xendit tidak dapat dihubungi. Coba buat sesi pembayaran baru." }, { status: 502 });
  }
  const result = await response.json().catch(() => null) as { payment_session_id?: string; payment_link_url?: string | null; expires_at?: string; payment_id?: string | null; payment_request_id?: string | null } | null;
  if (!response.ok || !result?.payment_session_id || !result.payment_link_url || !isXenditUrl(result.payment_link_url)) {
    await prisma.$transaction([
      prisma.paymentSession.update({ where: { id: paymentSession.id }, data: { status: "FAILED", responseSnapshot: { httpStatus: response.status } } }),
      prisma.order.update({ where: { id: order.id }, data: { status: "CANCELED", canceledAt: new Date() } }),
    ]);
    return NextResponse.json({ error: "Xendit belum dapat membuat tautan pembayaran. Coba lagi nanti." }, { status: 502 });
  }
  await prisma.paymentSession.update({
    where: { id: paymentSession.id },
    data: { providerSessionId: result.payment_session_id, providerPaymentId: result.payment_id ?? undefined, providerPaymentRequestId: result.payment_request_id ?? undefined, checkoutUrl: result.payment_link_url, status: "PENDING", expiresAt: result.expires_at ? new Date(result.expires_at) : new Date(Date.now() + 30 * 60 * 1000), requestSnapshot: JSON.parse(JSON.stringify(requestBody)), responseSnapshot: JSON.parse(JSON.stringify(result)) },
  });
  return NextResponse.json({ checkoutUrl: result.payment_link_url });
}
