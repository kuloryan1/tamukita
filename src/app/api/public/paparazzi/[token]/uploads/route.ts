import { randomBytes, randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest, getRequestAddress } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { getR2Client, getR2Config } from "@/lib/r2";
import { childDataConsentRecord } from "@/lib/child-data-consent";
import { PAPARAZZI_CHILD_DATA_GUARDIAN_CONSENT_VERSION } from "@/lib/consent-versions";
import { PAPARAZZI_CONSENT_VERSION, PAPARAZZI_UPLOAD_TTL_MS, paparazziIsOpen, paparazziRetentionAt, paparazziTokenSchema, paparazziUploadSchema } from "@/lib/paparazzi";
import { paparazziInvitationSelect, paparazziPrivateHeaders, paparazziReceiptHash } from "@/lib/paparazzi-server";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!paparazziTokenSchema.safeParse(token).success) return NextResponse.json({ error: "QR acara tidak tersedia." }, { status: 404 });
  const config = getR2Config(); if (!config) return NextResponse.json({ error: "Penyimpanan foto belum tersedia. Coba lagi nanti." }, { status: 503 });
  const body = await readJsonBody(request, 2_000); if (!body.ok) return NextResponse.json({ error: "Detail foto tidak valid." }, { status: body.status });
  const parsed = paparazziUploadSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Gunakan JPG, PNG, atau WebP maksimal 10 MB dan lengkapi persetujuan. Foto anak memerlukan persetujuan orang tua/wali." }, { status: 400 });
  if (!await allowRequest(`paparazzi:upload:${getRequestAddress(request)}`, 600, 3_600)) return NextResponse.json({ error: "Terlalu banyak unggahan dari jaringan ini. Coba lagi nanti." }, { status: 429 });
  const photoId = randomUUID(); const receipt = randomBytes(32).toString("hex"); const now = new Date();
  const result = await getPrismaClient().$transaction(async tx => {
    const initial = await tx.paparazziAlbum.findUnique({ where: { token }, select: { id: true } });
    if (!initial) return { error: "QR acara tidak tersedia.", status: 404 } as const;
    await tx.$queryRaw`SELECT id FROM "paparazzi_albums" WHERE id = ${initial.id}::uuid FOR UPDATE`;
    const album = await tx.paparazziAlbum.findFirst({ where: { id: initial.id, token }, include: { invitation: { select: paparazziInvitationSelect } } });
    if (!album) return { error: "QR acara sudah diganti. Minta QR terbaru kepada pemilik acara.", status: 404 } as const;
    if (!paparazziIsOpen(album, now)) return { error: "Pengumpulan foto belum dibuka atau sudah ditutup oleh pemilik acara.", status: 410 } as const;
    const count = await tx.paparazziPhoto.count({ where: { albumId: album.id, deletedAt: null, retentionAt: { gt: now }, OR: [{ status: { in: ["PROCESSING", "READY"] } }, { status: "PENDING", createdAt: { gt: new Date(now.getTime() - PAPARAZZI_UPLOAD_TTL_MS) } }] } });
    if (count >= album.maxPhotos) return { error: "Album acara sudah penuh. Hubungi pemilik acara.", status: 409 } as const;
    const prefix = `${album.invitation.organizationId}/${album.invitationId}/${photoId}`;
    const sourceKey = `private/pending/paparazzi/${prefix}/source`;
    const retentionAt = paparazziRetentionAt(now, album.invitation.expiresAt);
    await tx.paparazziPhoto.create({ data: { id: photoId, albumId: album.id, sourceKey, processedKey: `private/paparazzi/${prefix}.jpg`, mimeType: parsed.data.contentType, sizeBytes: BigInt(parsed.data.sizeBytes), receiptHash: paparazziReceiptHash(receipt), consentAt: now, consentVersion: PAPARAZZI_CONSENT_VERSION, ...childDataConsentRecord(parsed.data.includesChildData, PAPARAZZI_CHILD_DATA_GUARDIAN_CONSENT_VERSION, now), retentionAt } });
    return { sourceKey, retentionAt } as const;
  });
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status, headers: paparazziPrivateHeaders });
  const uploadUrl = await getSignedUrl(getR2Client(), new PutObjectCommand({ Bucket: config.privateBucket, Key: result.sourceKey, ContentType: parsed.data.contentType, ContentLength: parsed.data.sizeBytes }), { expiresIn: 300 });
  return NextResponse.json({ photoId, receipt, uploadUrl, expiresIn: 300, retentionAt: result.retentionAt.toISOString() }, { status: 201, headers: paparazziPrivateHeaders });
}
