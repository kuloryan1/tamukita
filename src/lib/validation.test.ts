import { expect, test } from "vitest";
import { createInitialDraft } from "@/lib/invitations";
import { validateInvitationDraft } from "@/lib/validation";

test("accepts a complete valid wedding draft", () => {
  expect(validateInvitationDraft(createInitialDraft())).toEqual({ valid: true });
});

test("rejects impossible event dates rather than allowing JavaScript date rollover", () => {
  const draft = { ...createInitialDraft(), eventDate: "2027-02-29" };

  expect(validateInvitationDraft(draft)).toEqual({
    valid: false,
    message: "Pilih tanggal acara yang valid.",
    step: 1,
  });
});

test("accepts leap days in leap years", () => {
  const draft = { ...createInitialDraft(), eventDate: "2028-02-29" };

  expect(validateInvitationDraft(draft)).toEqual({ valid: true });
});

test("requires a complete set of gift transfer details", () => {
  const draft = { ...createInitialDraft(), giftBankName: "BCA" };

  expect(validateInvitationDraft(draft)).toEqual({
    valid: false,
    message: "Lengkapi nama bank, nama pemilik rekening, dan nomor rekening hadiah.",
    step: 1,
  });
});

test("rejects insecure map links and reserved public slugs", () => {
  const insecureMap = { ...createInitialDraft(), mapsUrl: "http://maps.example.com/place" };
  const reservedSlug = { ...createInitialDraft(), slug: "admin" };

  expect(validateInvitationDraft(insecureMap).step).toBe(1);
  expect(validateInvitationDraft(reservedSlug).step).toBe(3);
});
