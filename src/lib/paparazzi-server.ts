import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { PAPARAZZI_CONSENT_VERSION, PAPARAZZI_MAX_BYTES, PAPARAZZI_RETENTION_DAYS, paparazziGalleryVisible, paparazziIsOpen, paparazziTokenSchema, paparazziUrl, type PaparazziOwnerAlbum, type PaparazziPublicAlbum } from "@/lib/paparazzi";
import { PAPARAZZI_CHILD_DATA_GUARDIAN_CONSENT_VERSION } from "@/lib/consent-versions";

export const paparazziPrivateHeaders = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
export const paparazziInvitationSelect = {
  id: true, ownerId: true, organizationId: true, title: true, slug: true, status: true,
  deletedAt: true, startsAt: true, expiresAt: true, organization: { select: { status: true } },
} satisfies Prisma.InvitationSelect;

export function paparazziOwnerWhere(userId: string, invitationId?: string): Prisma.InvitationWhereInput {
  return { ...(invitationId ? { id: invitationId } : {}), ownerId: userId, deletedAt: null,
    organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } };
}

export function paparazziReceiptHash(receipt: string) {
  return createHash("sha256").update(receipt).digest("hex");
}

export function paparazziReceiptMatches(receipt: string, expected: string) {
  if (!/^[a-f0-9]{64}$/.test(receipt) || !/^[a-f0-9]{64}$/.test(expected)) return false;
  return timingSafeEqual(Buffer.from(paparazziReceiptHash(receipt), "hex"), Buffer.from(expected, "hex"));
}

export async function getPaparazziAlbumByToken(token: string) {
  if (!paparazziTokenSchema.safeParse(token).success) return null;
  return getPrismaClient().paparazziAlbum.findUnique({ where: { token }, include: { invitation: { select: paparazziInvitationSelect } } });
}

export async function getPublicPaparazziAlbum(token: string): Promise<PaparazziPublicAlbum | null> {
  const album = await getPaparazziAlbumByToken(token);
  if (!album) return null;
  const invitation = album.invitation;
  const visible = paparazziGalleryVisible(invitation);
  return { title: visible ? invitation.title : "Acara TamuKita", open: paparazziIsOpen(album), galleryAvailable: visible, invitationSlug: visible ? invitation.slug : null, closesAt: album.closesAt.toISOString(), maxBytes: PAPARAZZI_MAX_BYTES, retentionDays: PAPARAZZI_RETENTION_DAYS };
}

export async function getOwnerPaparazziAlbum(userId: string, invitationId: string, cursor?: string): Promise<PaparazziOwnerAlbum | null> {
  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({ where: paparazziOwnerWhere(userId, invitationId), select: { ...paparazziInvitationSelect, paparazziAlbum: true } });
  if (!invitation) return null;
  const base = { invitation: { id: invitation.id, title: invitation.title, slug: invitation.slug, status: invitation.status, expiresAt: invitation.expiresAt?.toISOString() ?? null }, album: null, photos: [], nextCursor: null };
  const album = invitation.paparazziAlbum;
  if (!album) return base;
  const now = new Date();
  const [photos, count, readyCount] = await Promise.all([
    prisma.paparazziPhoto.findMany({
      where: { albumId: album.id, deletedAt: null, retentionAt: { gt: now } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 41,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, status: true, isVisible: true, createdAt: true, retentionAt: true, width: true, height: true },
    }),
    prisma.paparazziPhoto.count({ where: { albumId: album.id, deletedAt: null, status: { in: ["PENDING", "PROCESSING", "READY"] }, retentionAt: { gt: now } } }),
    prisma.paparazziPhoto.count({ where: { albumId: album.id, deletedAt: null, status: "READY", retentionAt: { gt: now } } }),
  ]);
  return { ...base, album: { enabled: album.enabled, open: paparazziIsOpen({ ...album, invitation }), closesAt: album.closesAt.toISOString(), maxPhotos: album.maxPhotos, count, readyCount, qrVersion: album.updatedAt.toISOString(), shareUrl: paparazziUrl(album.token, process.env.NEXT_PUBLIC_APP_URL || "https://tamukita.io") },
    photos: photos.slice(0, 40).map(photo => ({ ...photo, createdAt: photo.createdAt.toISOString(), retentionAt: photo.retentionAt.toISOString() })), nextCursor: photos.length > 40 ? photos[39].id : null };
}

export function paparazziPublicPhotoWhere(token: string, photoId?: string): Prisma.PaparazziPhotoWhereInput {
  const now = new Date();
  return { ...(photoId ? { id: photoId } : {}), status: "READY", isVisible: true, deletedAt: null, retentionAt: { gt: now }, consentVersion: PAPARAZZI_CONSENT_VERSION,
    OR: [{ includesChildData: false }, { includesChildData: true, guardianConsentAt: { not: null }, guardianConsentVersion: PAPARAZZI_CHILD_DATA_GUARDIAN_CONSENT_VERSION }],
    album: { token, invitation: { status: "PUBLISHED", deletedAt: null, expiresAt: { gt: now }, organization: { status: "ACTIVE" } } } };
}
