import { describe, expect, it } from "vitest";
import { PAPARAZZI_MAX_BYTES, paparazziGalleryVisible, paparazziIsOpen, paparazziRetentionAt, paparazziUploadSchema, paparazziUrl } from "./paparazzi";

const token = "a".repeat(64);
const now = new Date("2026-10-30T08:00:00Z");
const invitation = { status: "PUBLISHED", deletedAt: null, expiresAt: new Date("2027-02-01T00:00:00Z"), organization: { status: "ACTIVE" } };

describe("event QR and availability", () => {
  it("closes uploads and gallery access when the parent event has been removed", () => {
    expect(paparazziGalleryVisible(null, now)).toBe(false);
    expect(paparazziIsOpen(null, now)).toBe(false);
    expect(paparazziIsOpen({ enabled: true, closesAt: new Date("2027-01-01"), invitation: null }, now)).toBe(false);
    expect(paparazziGalleryVisible({ ...invitation, organization: null }, now)).toBe(false);
  });
  it("builds the QR destination only from a canonical secure origin", () => {
    expect(paparazziUrl(token, "https://staging.tamukita.io")).toBe(`https://staging.tamukita.io/paparazi/${token}`);
    expect(paparazziUrl(token, "http://127.0.0.1:23300/")).toBe(`http://127.0.0.1:23300/paparazi/${token}`);
    expect(() => paparazziUrl(`${token}/../admin`, "https://tamukita.io")).toThrow();
  });
  it.each(["http://tamukita.io", "javascript:alert(1)", "https://user:password@tamukita.io", "https://tamukita.io/subpath", "https://tamukita.io/?next=evil", "https://tamukita.io/#fragment"])("rejects an unsafe QR base: %s", base => {
    expect(() => paparazziUrl(token, base)).toThrow();
  });
  it("keeps existing public photos accessible when collecting is paused or closed", () => {
    expect(paparazziGalleryVisible(invitation, now)).toBe(true);
    expect(paparazziIsOpen({ enabled: false, closesAt: new Date("2026-11-01"), invitation }, now)).toBe(false);
    expect(paparazziIsOpen({ enabled: true, closesAt: now, invitation }, now)).toBe(false);
    expect(paparazziIsOpen({ enabled: true, closesAt: new Date(now.getTime() + 1), invitation }, now)).toBe(true);
  });
  it.each(["DRAFT", "SUSPENDED", "EXPIRED", "PENDING_REVIEW"])("does not expose photos for an invitation in %s", status => {
    expect(paparazziGalleryVisible({ ...invitation, status }, now)).toBe(false);
  });
  it("closes both reading and uploading when hosting, organization, or invitation is no longer active", () => {
    for (const unavailable of [{ ...invitation, expiresAt: now }, { ...invitation, expiresAt: null }, { ...invitation, deletedAt: now }, { ...invitation, organization: { status: "SUSPENDED" } }]) {
      expect(paparazziGalleryVisible(unavailable, now)).toBe(false);
      expect(paparazziIsOpen({ enabled: true, closesAt: new Date("2027-01-01"), invitation: unavailable }, now)).toBe(false);
    }
  });
});

describe("public photo sharing consent and retention", () => {
  const input = { contentType: "image/jpeg", sizeBytes: 2400, consent: true, includesChildData: false, guardianConsent: false };
  it("requires explicit public sharing consent before reserving storage", () => {
    expect(paparazziUploadSchema.safeParse(input).success).toBe(true);
    expect(paparazziUploadSchema.safeParse({ ...input, consent: false }).success).toBe(false);
    const { consent: _omitted, ...withoutConsent } = input;
    expect(paparazziUploadSchema.safeParse(withoutConsent).success).toBe(false);
  });
  it("requires the guardian attestation exactly when the photo contains child data", () => {
    expect(paparazziUploadSchema.safeParse({ ...input, includesChildData: true }).success).toBe(false);
    expect(paparazziUploadSchema.safeParse({ ...input, includesChildData: true, guardianConsent: true }).success).toBe(true);
    expect(paparazziUploadSchema.safeParse({ ...input, guardianConsent: true }).success).toBe(false);
  });
  it.each([{ contentType: "image/svg+xml" }, { contentType: "video/mp4" }, { sizeBytes: 0 }, { sizeBytes: PAPARAZZI_MAX_BYTES + 1 }, { sizeBytes: 1.5 }, { isVisible: true }])("rejects unsafe upload properties: %j", changes => {
    expect(paparazziUploadSchema.safeParse({ ...input, ...changes }).success).toBe(false);
  });
  it("limits photo retention to 90 days and to 30 days after hosting expires", () => {
    expect(paparazziRetentionAt(now, null).toISOString()).toBe("2027-01-28T08:00:00.000Z");
    expect(paparazziRetentionAt(now, new Date("2026-11-01T08:00:00Z")).toISOString()).toBe("2026-12-01T08:00:00.000Z");
    expect(paparazziRetentionAt(now, invitation.expiresAt).toISOString()).toBe("2027-01-28T08:00:00.000Z");
  });
});
