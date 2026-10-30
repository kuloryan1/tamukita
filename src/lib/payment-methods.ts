import { z } from "zod";

export type PaymentMode = "manual" | "xendit";
export type PaymentSettings = { mode: PaymentMode; qrImageUrl: string; whatsapp: string; ready: boolean };
export const paymentOrderIdSchema = z.string().uuid();

export function normalizePaymentWhatsapp(value: string) {
  let digits = value.trim().replace(/[\s()+.-]/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  return /^628\d{7,11}$/.test(digits) ? digits : null;
}

export const manualPaymentSnapshotSchema = z.object({
  kind: z.literal("MANUAL_QR"),
  version: z.literal(1),
  qrImageUrl: z.string().url().max(1_000).refine(value => {
    const url = new URL(value);
    return !url.username && !url.password && !url.search && !url.hash
      && (url.protocol === "https:" || (url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
  }),
  whatsapp: z.string().regex(/^628\d{7,11}$/),
}).strict();

export function manualCheckoutPath(orderId: string) {
  return `/dashboard/payments/${encodeURIComponent(orderId)}`;
}

export function manualPaymentWhatsappUrl(whatsapp: string, orderId: string, amountIdr: number) {
  const number = normalizePaymentWhatsapp(whatsapp);
  if (!number) return null;
  const amount = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(amountIdr);
  const url = new URL(`https://wa.me/${number}`);
  url.searchParams.set("text", `Halo TamuKita, saya ingin mengonfirmasi pembayaran QR untuk order ${orderId} sebesar ${amount}. Saya akan melampirkan bukti pembayaran.`);
  return url.toString();
}
