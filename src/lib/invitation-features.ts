export type FeatureGrantValue = { featureKey: string; value: unknown };

export type InvitationFeatureAccess = {
  planManaged: boolean;
  galleryLimit: number;
  music: boolean;
  rsvp: boolean;
};

export type FeatureDraft = { galleryPhotos: string[]; musicUrl: string };

export function isValidKnownFeatureEntitlement(featureKey: string, value: unknown) {
  if (featureKey === "gallery.limit") return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 6;
  if (featureKey === "music" || featureKey === "rsvp.enabled") return typeof value === "boolean";
  return true;
}

export const legacyInvitationFeatureAccess: InvitationFeatureAccess = {
  planManaged: false,
  galleryLimit: 6,
  music: true,
  rsvp: true,
};

export function resolveInvitationFeatureAccess(grants: readonly FeatureGrantValue[] | null): InvitationFeatureAccess {
  if (grants === null) return legacyInvitationFeatureAccess;

  const values = new Map(grants.map(({ featureKey, value }) => [featureKey, value]));
  const galleryValue = values.get("gallery.limit");
  const galleryLimit = typeof galleryValue === "number" && Number.isSafeInteger(galleryValue) && galleryValue >= 0 && galleryValue <= 6
    ? galleryValue
    : 0;

  return {
    planManaged: true,
    galleryLimit,
    music: values.get("music") === true,
    rsvp: values.get("rsvp.enabled") === true,
  };
}

export function validateDraftFeatureAccess(draft: FeatureDraft, access: InvitationFeatureAccess): string | null {
  if (draft.galleryPhotos.length > access.galleryLimit) {
    return access.galleryLimit === 0
      ? "Paket ini belum mencakup galeri foto. Hapus foto galeri atau pilih paket lain."
      : `Paket ini mencakup galeri hingga ${access.galleryLimit} foto. Hapus foto tambahan sebelum melanjutkan.`;
  }
  if (draft.musicUrl && !access.music) return "Paket ini belum mencakup musik latar. Hapus musik atau pilih paket lain.";
  return null;
}

export function summarizeInvitationFeatureAccess(access: InvitationFeatureAccess): string[] {
  const features: string[] = [];
  if (access.galleryLimit > 0) features.push(`Galeri ${access.galleryLimit} foto`);
  if (access.music) features.push("Musik latar");
  if (access.rsvp) features.push("RSVP");
  return features;
}
