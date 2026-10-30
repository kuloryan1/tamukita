import { expect, test } from "vitest";
import { manualPaymentSnapshotSchema, manualPaymentWhatsappUrl, normalizePaymentWhatsapp } from "./payment-methods";

test("payment contacts normalize Indonesian numbers and reject malformed destinations", () => {
  expect(normalizePaymentWhatsapp("0812 0000 0000")).toBe("6281200000000");
  expect(normalizePaymentWhatsapp("+62 812-0000-0000")).toBe("6281200000000");
  expect(normalizePaymentWhatsapp("81200000000")).toBe("6281200000000");
  for (const value of ["", "123", "https://evil.example", "62812?text=other", "62812abc00000", "+12025550100"]) expect(normalizePaymentWhatsapp(value)).toBeNull();
});

test("payment WhatsApp links encode the order and exact amount without changing destination", () => {
  const href = manualPaymentWhatsappUrl("6281200000000", "order & reference", 149_000);
  const url = new URL(href ?? "");
  expect(url.origin).toBe("https://wa.me");
  expect(url.pathname).toBe("/6281200000000");
  expect(url.searchParams.get("text")).toContain("order & reference");
  expect(url.searchParams.get("text")).toContain("149.000");
  expect(manualPaymentWhatsappUrl("bad-number", "order", 1)).toBeNull();
});

test("manual instruction snapshots require the recorded QR, contact, and supported version", () => {
  const snapshot = { kind: "MANUAL_QR", version: 1, qrImageUrl: "https://media.example/platform/payment-qr/qa.png", whatsapp: "6281200000000" };
  expect(manualPaymentSnapshotSchema.safeParse(snapshot).success).toBe(true);
  for (const invalid of [{ ...snapshot, whatsapp: "" }, { ...snapshot, version: 2 }, { ...snapshot, qrImageUrl: "javascript:alert(1)" }, { ...snapshot, paid: true }]) {
    expect(manualPaymentSnapshotSchema.safeParse(invalid).success).toBe(false);
  }
});
