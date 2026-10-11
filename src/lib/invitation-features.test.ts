import { expect, test } from "vitest";
import { isValidKnownFeatureEntitlement, legacyInvitationFeatureAccess, resolveInvitationFeatureAccess, summarizeInvitationFeatureAccess, validateDraftFeatureAccess } from "@/lib/invitation-features";

test("keeps existing invitations compatible when no plan-based grants exist", () => {
  expect(resolveInvitationFeatureAccess(null)).toEqual(legacyInvitationFeatureAccess);
});

test("uses explicit plan grants and leaves missing features disabled", () => {
  const access = resolveInvitationFeatureAccess([
    { featureKey: "gallery.limit", value: 3 },
    { featureKey: "music", value: true },
  ]);

  expect(access).toEqual({ planManaged: true, galleryLimit: 3, music: true, rsvp: false });
  expect(summarizeInvitationFeatureAccess(access)).toEqual(["Galeri 3 foto", "Musik latar"]);
});

test("treats invalid entitlement values as unavailable", () => {
  expect(resolveInvitationFeatureAccess([
    { featureKey: "gallery.limit", value: 99 },
    { featureKey: "music", value: "yes" },
    { featureKey: "rsvp.enabled", value: 1 },
  ])).toEqual({ planManaged: true, galleryLimit: 0, music: false, rsvp: false });
});

test("validates known package feature values before they can be activated", () => {
  expect(isValidKnownFeatureEntitlement("gallery.limit", 6)).toBe(true);
  expect(isValidKnownFeatureEntitlement("gallery.limit", 7)).toBe(false);
  expect(isValidKnownFeatureEntitlement("music", true)).toBe(true);
  expect(isValidKnownFeatureEntitlement("rsvp.enabled", "true")).toBe(false);
});

test("rejects gallery overflow and music outside a package", () => {
  const access = resolveInvitationFeatureAccess([{ featureKey: "gallery.limit", value: 1 }]);

  expect(validateDraftFeatureAccess({ galleryPhotos: ["one", "two"], musicUrl: "" }, access)).toContain("hingga 1 foto");
  expect(validateDraftFeatureAccess({ galleryPhotos: [], musicUrl: "https://media.example/music.mp3" }, access)).toContain("musik latar");
  expect(validateDraftFeatureAccess({ galleryPhotos: ["one"], musicUrl: "" }, access)).toBeNull();
});
