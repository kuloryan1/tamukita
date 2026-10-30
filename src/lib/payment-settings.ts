import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { r2KeyFromPublicUrl } from "@/lib/r2";
import { manualCheckoutPath, normalizePaymentWhatsapp, type PaymentSettings } from "@/lib/payment-methods";

export const paymentSettingKeys = {
  mode: "payment.mode",
  qrImageUrl: "payment.manual_qr_image_url",
  whatsapp: "payment.manual_whatsapp",
} as const;

export function isPaymentQrUrl(value: string) {
  return r2KeyFromPublicUrl(value)?.startsWith("platform/payment-qr/") === true;
}

export async function getPaymentSettings(): Promise<PaymentSettings> {
  const rows = await getPrismaClient().platformSetting.findMany({
    where: { key: { in: Object.values(paymentSettingKeys) } }, select: { key: true, value: true },
  });
  const values = new Map(rows.map(row => [row.key, row.value]));
  const storedMode = values.get(paymentSettingKeys.mode) ?? process.env.PAYMENT_MODE;
  const mode = storedMode === "xendit" ? "xendit" : "manual";
  const rawQr = values.get(paymentSettingKeys.qrImageUrl) ?? process.env.MANUAL_PAYMENT_QR_URL ?? "";
  const qrImageUrl = typeof rawQr === "string" && isPaymentQrUrl(rawQr) ? rawQr : "";
  const rawWhatsapp = values.get(paymentSettingKeys.whatsapp) ?? process.env.MANUAL_PAYMENT_WHATSAPP ?? "";
  const whatsapp = typeof rawWhatsapp === "string" ? normalizePaymentWhatsapp(rawWhatsapp) ?? "" : "";
  return { mode, qrImageUrl, whatsapp, ready: mode === "xendit" || Boolean(qrImageUrl && whatsapp) };
}

export function paymentSessionInput(orderId: string, amountIdr: number, settings: PaymentSettings, flow: string): Prisma.PaymentSessionCreateWithoutOrderInput {
  if (settings.mode === "manual") {
    if (!settings.ready) throw new Error("QR pembayaran belum dikonfigurasi.");
    return {
      provider: "MANUAL", status: "PENDING", amountIdr, currency: "IDR",
      checkoutUrl: manualCheckoutPath(orderId),
      requestSnapshot: { kind: "MANUAL_QR", version: 1, qrImageUrl: settings.qrImageUrl, whatsapp: settings.whatsapp },
    };
  }
  return { provider: "XENDIT", status: "CREATED", amountIdr, currency: "IDR", requestSnapshot: { flow, sessionType: "PAY" } };
}

export function isReusableCheckout(session: { provider: string; status: string; checkoutUrl: string | null; expiresAt: Date | null }, settings: PaymentSettings) {
  if (session.status !== "PENDING" || !session.checkoutUrl) return false;
  if (settings.mode === "manual") return session.provider === "MANUAL" && session.checkoutUrl.startsWith("/dashboard/payments/");
  return session.provider === "XENDIT" && Boolean(session.expiresAt && session.expiresAt > new Date());
}
