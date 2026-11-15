import { expect, test } from "vitest";
import { defaultGuestWhatsAppMessage, GUEST_MESSAGE_MAX_LENGTH, guestMessageError, renderGuestWhatsAppMessage, WEDDING_GUEST_MESSAGE } from "./guest-whatsapp-message";
import { whatsappShareUrl } from "./whatsapp-link";

test("wedding example preserves paragraphs and personalizes each recipient", () => {
  const url = "https://tamukita.test/wulan-dan-ryan?g=guest-a";
  const message = renderGuestWhatsAppMessage(WEDDING_GUEST_MESSAGE, { name: "Mbak Dwi", eventTitle: "Wulan & Ryan", url });
  expect(guestMessageError(WEDDING_GUEST_MESSAGE)).toBeNull();
  expect(message).toContain("Yth. Mbak Dwi\n\nTanpa mengurangi");
  expect(message).toContain("\n\nWulan & Ryan\n\n");
  expect(message).toContain(url);
  expect(message).not.toMatch(/\{(?:nama_tamu|nama_acara|link_undangan)\}/);
  expect(message).toContain("Wassalamu'alaikum Wr. Wb.");
});

test("replacement handles repeated markers, Unicode and literal replacement syntax", () => {
  const message = renderGuestWhatsAppMessage("{nama_tamu} / {nama_tamu}\n{nama_acara}\n{link_undangan}", {
    name: "Dwi $& {link_undangan} 🌸", eventTitle: "Wulan & Ryan", url: "https://tamukita.test/acara?g=a_b-c",
  });
  expect(message).toBe("Dwi $& {link_undangan} 🌸 / Dwi $& {link_undangan} 🌸\nWulan & Ryan\nhttps://tamukita.test/acara?g=a_b-c");
});

test("WhatsApp URL round trips the complete edited message without losing line breaks or link tokens", () => {
  const template = "Assalamu'alaikum\n\nYth. {nama_tamu}\n*Wulan & Ryan* 😊\n{link_undangan}\nTerima kasih!";
  const first = renderGuestWhatsAppMessage(template, { name: "Dwi & keluarga", eventTitle: "Wulan & Ryan", url: "https://tamukita.test/acara?g=a_b-c&to=Dwi" });
  const second = renderGuestWhatsAppMessage(template, { name: "Ryan", eventTitle: "Wulan & Ryan", url: "https://tamukita.test/acara?g=other" });
  const url = new URL(whatsappShareUrl("085733960623", first));
  expect(url.origin).toBe("https://wa.me");
  expect(url.pathname).toBe("/6285733960623");
  expect(url.searchParams.get("text")).toBe(first);
  expect(second).not.toContain("g=a_b-c");
  expect(second).toContain("g=other");
});

test.each(["", "   ", "Pesan tanpa tautan", "{nama_tam} {link_undangan}", `${"a".repeat(GUEST_MESSAGE_MAX_LENGTH)}{link_undangan}`])("rejects unusable message: %s", (template) => {
  expect(guestMessageError(template)).toBeTruthy();
});

test("uses a neutral default for other event types", () => {
  expect(defaultGuestWhatsAppMessage("Pernikahan")).toBe(WEDDING_GUEST_MESSAGE);
  expect(defaultGuestWhatsAppMessage("Ulang Tahun")).not.toContain("pernikahan");
  expect(guestMessageError(defaultGuestWhatsAppMessage(undefined))).toBeNull();
});
