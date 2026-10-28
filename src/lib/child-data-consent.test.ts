import { describe, expect, it } from "vitest";
import { childDataConsentRecord, guardianConsentMatchesChildData } from "@/lib/child-data-consent";
import { GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_VERSION, RSVP_CHILD_DATA_GUARDIAN_CONSENT_VERSION } from "@/lib/consent-versions";
import { GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_COPY, RSVP_CHILD_DATA_GUARDIAN_CONSENT_COPY } from "@/lib/consent-copy";

describe("child data guardian consent record", () => {
  it("stores no consent record when a submission contains no child data", () => {
    const now = new Date("2026-10-26T00:00:00.000Z");

    expect(childDataConsentRecord(false, RSVP_CHILD_DATA_GUARDIAN_CONSENT_VERSION, now)).toEqual({
      includesChildData: false,
      guardianConsentAt: null,
      guardianConsentVersion: null,
    });
  });

  it("stores the consent time and wording version when child data is included", () => {
    const now = new Date("2026-10-26T00:00:00.000Z");

    expect(childDataConsentRecord(true, RSVP_CHILD_DATA_GUARDIAN_CONSENT_VERSION, now)).toEqual({
      includesChildData: true,
      guardianConsentAt: now,
      guardianConsentVersion: RSVP_CHILD_DATA_GUARDIAN_CONSENT_VERSION,
    });
  });

  it("keeps RSVP and public guestbook consent versions distinct", () => {
    expect(RSVP_CHILD_DATA_GUARDIAN_CONSENT_VERSION).not.toBe(GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_VERSION);
    expect(GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_VERSION).toContain("guestbook");
    expect(RSVP_CHILD_DATA_GUARDIAN_CONSENT_COPY).toContain("mencatat kehadiran");
    expect(GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_COPY).toContain("dapat tampil pada halaman undangan yang bisa dilihat publik");
  });

  it("requires guardian consent exactly when child data is declared", () => {
    expect(guardianConsentMatchesChildData(false, false)).toBe(true);
    expect(guardianConsentMatchesChildData(true, true)).toBe(true);
    expect(guardianConsentMatchesChildData(true, false)).toBe(false);
    expect(guardianConsentMatchesChildData(false, true)).toBe(false);
  });
});
