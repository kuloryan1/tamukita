import type { S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import type { Prisma, PrismaClient } from "../generated/prisma/client";
import { PAPARAZZI_MAX_BYTES, PAPARAZZI_UPLOAD_TTL_MS, paparazziJobSchema } from "./paparazzi";
import { paparazziStorage } from "./paparazzi-storage";
import { removePaparazziTemporaryFiles } from "./paparazzi-server-files";

export class InvalidPaparazziPhotoError extends Error {}

export async function deletePaparazziPhotoObjects(prisma: PrismaClient, s3: S3Client | null, bucket: string | undefined, photoId: string) {
  const photo = await prisma.paparazziPhoto.findUnique({ where: { id: photoId } });
  if (!photo?.deletedAt || photo.storageDeletedAt) return;
  const storage = paparazziStorage(photo.storageProvider, s3, bucket, AbortSignal.timeout(30_000));
  for (const key of [photo.sourceKey, photo.processedKey]) await storage.delete(key);
  if (photo.storageProvider === "SERVER") await removePaparazziTemporaryFiles(photo.id);
  // A worker already holding the input may finish a late write after deletion.
  // Keep recent in-flight deletions eligible for the maintenance retry.
  const settling = photo.createdAt.getTime() + PAPARAZZI_UPLOAD_TTL_MS > Date.now()
    || Boolean(photo.processingStartedAt && photo.deletedAt.getTime() > Date.now() - 60 * 60 * 1_000);
  await prisma.paparazziPhoto.updateMany({ where: { id: photo.id, deletedAt: { not: null } }, data: { storageDeletedAt: settling ? null : new Date(), receiptHash: photo.status === "FAILED" ? photo.receiptHash : "", guardianConsentAt: null, guardianConsentVersion: null } });
}

export async function processPaparazziPhoto(prisma: PrismaClient, s3: S3Client | null, bucket: string | undefined, value: unknown) {
  const io = { abortSignal: AbortSignal.timeout(120_000) };
  const payload = paparazziJobSchema.parse(value);
  const startedAt = new Date(payload.processingStartedAt);
  const photo = await prisma.paparazziPhoto.findUnique({ where: { id: payload.photoId }, include: { album: { select: { invitation: { select: { organizationId: true, id: true } } } } } });
  if (photo?.status === "READY" && !photo.deletedAt) { await paparazziStorage(photo.storageProvider, s3, bucket, io.abortSignal).delete(photo.sourceKey); return; }
  if (photo?.status !== "PROCESSING" || photo.deletedAt || photo.processingStartedAt?.getTime() !== startedAt.getTime()) return;
  const storage = paparazziStorage(photo.storageProvider, s3, bucket, io.abortSignal);
  const prefix = `${photo.album.invitation.organizationId}/${photo.album.invitation.id}/${photo.id}`;
  if (!photo.sourceKey.startsWith(`private/pending/paparazzi/${prefix}/`) || photo.processedKey !== `private/paparazzi/${prefix}.jpg`) throw new InvalidPaparazziPhotoError("Lokasi foto tidak valid.");
  const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
  const expectedFormat = formats[photo.mimeType];
  if (!expectedFormat || photo.sizeBytes < BigInt(1) || photo.sizeBytes > BigInt(PAPARAZZI_MAX_BYTES)) throw new InvalidPaparazziPhotoError("Format atau ukuran foto tidak valid.");
  const head = await storage.head(photo.sourceKey);
  if (head.size !== Number(photo.sizeBytes) || ("contentType" in head && head.contentType !== photo.mimeType)) throw new InvalidPaparazziPhotoError("Data foto tidak sesuai unggahan.");
  const reader = (await storage.read(photo.sourceKey)).getReader();
  const abortRead = () => { void reader.cancel().catch(() => {}); };
  io.abortSignal.addEventListener("abort", abortRead, { once: true });
  if (io.abortSignal.aborted) abortRead();
  const chunks: Buffer[] = []; let bytes = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > PAPARAZZI_MAX_BYTES) { await reader.cancel(); throw new InvalidPaparazziPhotoError("Foto terlalu besar."); }
      chunks.push(Buffer.from(result.value));
    }
  } finally { io.abortSignal.removeEventListener("abort", abortRead); reader.releaseLock(); }
  if (io.abortSignal.aborted) throw new Error("Paparazzi storage processing timed out.");
  const source = Buffer.concat(chunks);
  let output: { data: Buffer; info: { width: number; height: number; size: number } };
  try {
    const image = sharp(source, { failOn: "error", limitInputPixels: 40_000_000, animated: false });
    const metadata = await image.metadata();
    if (metadata.format !== expectedFormat || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) throw new Error("Invalid image");
    output = await image.rotate().resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true }).flatten({ background: "#fff" }).jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  } catch { throw new InvalidPaparazziPhotoError("Foto tidak dapat dibaca. Gunakan JPG, PNG, atau WebP yang valid."); }
  await storage.write(photo.processedKey, output.data, "image/jpeg");
  const updated = await prisma.paparazziPhoto.updateMany({ where: { id: photo.id, status: "PROCESSING", processingStartedAt: startedAt, deletedAt: null, retentionAt: { gt: new Date() } }, data: { status: "READY", processedBytes: BigInt(output.info.size), width: output.info.width, height: output.info.height } });
  if (updated.count !== 1) {
    const current = await prisma.paparazziPhoto.findUnique({ where: { id: photo.id } });
    if (current?.deletedAt) await deletePaparazziPhotoObjects(prisma, s3, bucket, photo.id);
    else if (current?.status !== "READY") await storage.delete(photo.processedKey);
  }
  await storage.delete(photo.sourceKey);
}

export async function failPaparazziPhoto(prisma: PrismaClient, s3: S3Client | null, bucket: string | undefined, value: unknown) {
  const parsed = paparazziJobSchema.safeParse(value); if (!parsed.success) return;
  const photo = await prisma.paparazziPhoto.findUnique({ where: { id: parsed.data.photoId } });
  if (photo?.status !== "PROCESSING" || photo.processingStartedAt?.toISOString() !== parsed.data.processingStartedAt) return;
  await prisma.paparazziPhoto.updateMany({ where: { id: photo.id, status: "PROCESSING", processingStartedAt: photo.processingStartedAt }, data: { status: "FAILED", deletedAt: new Date() } });
  if (photo.storageProvider === "SERVER" || (s3 && bucket)) await deletePaparazziPhotoObjects(prisma, s3, bucket, photo.id);
}

export async function sweepPaparazziPhotos(prisma: PrismaClient, s3: S3Client | null, bucket?: string, now = new Date()) {
  const stale = new Date(now.getTime() - PAPARAZZI_UPLOAD_TTL_MS);
  const hostingCutoff = new Date(now.getTime() - 30 * 86_400_000);
  const eligible: Prisma.PaparazziPhotoWhereInput = { ...(s3 && bucket ? {} : { storageProvider: "SERVER" }), storageDeletedAt: null, OR: [
      { deletedAt: { not: null } }, { retentionAt: { lte: now } },
      { status: "PENDING", createdAt: { lt: stale } },
      { status: "PROCESSING", processingStartedAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) } },
      { album: { invitation: { OR: [{ deletedAt: { lte: hostingCutoff } }, { expiresAt: { lte: hostingCutoff } }] } } },
    ] };
  const photos = await prisma.paparazziPhoto.findMany({
    where: eligible, take: 100, orderBy: { createdAt: "asc" }, select: { id: true },
  });
  for (const photo of photos) {
    await prisma.paparazziPhoto.updateMany({ where: { AND: [eligible, { id: photo.id, deletedAt: null }] }, data: { status: "DELETED", deletedAt: now } });
    await deletePaparazziPhotoObjects(prisma, s3, bucket, photo.id);
  }
  return photos.length;
}
