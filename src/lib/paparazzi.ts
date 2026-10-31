import { z } from "zod";
import { guardianConsentMatchesChildData } from "./child-data-consent";

export const PAPARAZZI_MAX_BYTES = 10_000_000;
export const PAPARAZZI_RETENTION_DAYS = 90;
export const PAPARAZZI_UPLOAD_TTL_MS = 15 * 60 * 1_000;
export const PAPARAZZI_CONSENT_VERSION = "paparazzi-public-2026-10-v1";
export const PAPARAZZI_CONSENT_COPY = "Saya berusia minimal 18 tahun dan memiliki izin membagikan foto ini. Saya memahami foto akan langsung tampil di galeri acara yang bisa dilihat publik melalui QR atau tautan acara.";
export const PAPARAZZI_GUARDIAN_COPY = "Saya orang tua/wali yang berwenang dan menyetujui TamuKita memproses foto anak ini serta langsung menampilkannya di galeri acara yang bisa dilihat publik.";

export const paparazziTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
export const paparazziPhotoIdSchema = z.string().uuid();
export const paparazziUploadSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().min(1).max(PAPARAZZI_MAX_BYTES),
  consent: z.literal(true),
  includesChildData: z.boolean(),
  guardianConsent: z.boolean(),
}).strict().refine(value => guardianConsentMatchesChildData(value.includesChildData, value.guardianConsent), { message: "Persetujuan orang tua/wali diperlukan untuk foto anak." });
export const paparazziReceiptSchema = z.object({ receipt: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
export const paparazziJobSchema = z.object({ photoId: z.string().uuid(), processingStartedAt: z.string().datetime() }).strict();

export function paparazziUrl(token: string, baseUrl: string) {
  paparazziTokenSchema.parse(token);
  const base = new URL(baseUrl);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if ((base.protocol !== "https:" && !(base.protocol === "http:" && loopback)) || base.username || base.password || base.search || base.hash || base.pathname !== "/") throw new Error("Alamat aplikasi untuk QR tidak valid.");
  return new URL(`/paparazi/${token}`, base).toString();
}

export function paparazziRetentionAt(now: Date, hostingExpiresAt: Date | null) {
  const maximum = now.getTime() + PAPARAZZI_RETENTION_DAYS * 86_400_000;
  return new Date(hostingExpiresAt ? Math.min(maximum, hostingExpiresAt.getTime() + 30 * 86_400_000) : maximum);
}

export function paparazziGalleryVisible(invitation: { status: string; deletedAt: Date | null; expiresAt: Date | null; organization: { status: string } | null } | null | undefined, now = new Date()) {
  return Boolean(invitation && invitation.status === "PUBLISHED" && !invitation.deletedAt && invitation.expiresAt && invitation.expiresAt > now && invitation.organization?.status === "ACTIVE");
}

export function paparazziIsOpen(album: { enabled: boolean; closesAt: Date; invitation: Parameters<typeof paparazziGalleryVisible>[0] } | null | undefined, now = new Date()) {
  return Boolean(album?.enabled && album.closesAt > now && paparazziGalleryVisible(album.invitation, now));
}

export type PaparazziPublicAlbum = { title: string; open: boolean; galleryAvailable: boolean; invitationSlug: string | null; closesAt: string; maxBytes: number; retentionDays: number };
export type PaparazziOwnerPhoto = { id: string; status: string; isVisible: boolean; createdAt: string; retentionAt: string; width: number | null; height: number | null };
export type PaparazziGallery = { photos: Array<{ id: string; width: number | null; height: number | null; createdAt: string }>; nextCursor: string | null };
export type PaparazziOwnerAlbum = {
  invitation: { id: string; title: string; slug: string; status: string; expiresAt: string | null };
  album: { enabled: boolean; open: boolean; closesAt: string; maxPhotos: number | null; shareUrl: string; qrVersion: string; count: number; readyCount: number } | null;
  photos: PaparazziOwnerPhoto[];
  nextCursor: string | null;
};
