import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import sharp from "sharp";
import type { PrismaClient } from "../generated/prisma/client";
import { mediaServerFilePath, mediaServerStore } from "./media-server-storage";

export type MediaProcessingConfig = {
  privateBucket: string;
  publicBucket: string;
  publicBaseUrl: string;
  allowLocalHttpPublicBaseUrl?: boolean;
};

export type MediaProcessingPayload = {
  mediaAssetId: string;
  processingStartedAt: string;
};

type ImageMetadata = { format?: string; width?: number; height?: number; pages?: number };
type OptimizedImage = { data: Buffer; info: { size: number; width: number; height: number } };

export type MediaEditProcessingPayload = {
  mediaAssetId: string;
  invitationId: string;
  requestedById: string;
  revisionKey: string;
  baseRevision: number;
  cropSizeBytes: number;
  cropData: Record<string, unknown>;
  activeCoverKey: string;
};

export class InvalidMediaAssetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMediaAssetError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type MediaObjectStore = {
  headPrivate(key: string): Promise<{ size?: number; contentType?: string }>;
  readPrivate(key: string): Promise<Buffer>;
  writePublic(key: string, bytes: Buffer, contentType: string): Promise<void>;
  deletePrivate(key: string): Promise<void>;
  deletePublic(key: string): Promise<void>;
};

function getMediaObjectStore(storageProvider: string, s3: S3Client | null, config: MediaProcessingConfig | null): MediaObjectStore {
  if (storageProvider === "SERVER") {
    const store = mediaServerStore();
    return {
      async headPrivate(key) { return { size: (await store.head(key)).size }; },
      readPrivate: store.read,
      async writePublic(key, bytes) { await store.write(key, bytes); },
      deletePrivate: store.delete,
      deletePublic: store.delete,
    };
  }
  if (storageProvider !== "R2" || !s3 || !config) throw new Error("Penyimpanan foto lama belum tersedia.");
  return {
    async headPrivate(key) {
      const head = await s3.send(new HeadObjectCommand({ Bucket: config.privateBucket, Key: key }));
      return { size: head.ContentLength, contentType: head.ContentType };
    },
    async readPrivate(key) { return bufferFromBody((await s3.send(new GetObjectCommand({ Bucket: config.privateBucket, Key: key }))).Body); },
    async writePublic(key, bytes, contentType) {
      await s3.send(new PutObjectCommand({ Bucket: config.publicBucket, Key: key, Body: bytes, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
    },
    async deletePrivate(key) { await s3.send(new DeleteObjectCommand({ Bucket: config.privateBucket, Key: key })); },
    async deletePublic(key) { await s3.send(new DeleteObjectCommand({ Bucket: config.publicBucket, Key: key })); },
  };
}

function mediaPublicUrlForWorker(storageProvider: string, key: string, config: MediaProcessingConfig | null) {
  const baseUrl = storageProvider === "SERVER" ? process.env.NEXT_PUBLIC_APP_URL : config?.publicBaseUrl;
  if (!baseUrl) throw new Error("Alamat publik media belum dikonfigurasi.");
  const prefix = storageProvider === "SERVER" ? "/api/media/files/" : "";
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  if (storageProvider === "SERVER") return new URL(`${prefix}${encodedKey}`, baseUrl).toString();
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(encodedKey, base).toString();
}

function mediaKeyFromUrlForWorker(storageProvider: string, config: MediaProcessingConfig | null, value: string) {
  const baseUrl = storageProvider === "SERVER" ? process.env.NEXT_PUBLIC_APP_URL : config?.publicBaseUrl;
  if (!baseUrl) return null;
  try {
    const base = new URL(baseUrl);
    const url = new URL(value);
    if (url.origin !== base.origin || url.search || url.hash || url.username || url.password) return null;
    if (storageProvider === "SERVER") {
      const prefix = "/api/media/files/";
      const localHttp = process.env.NODE_ENV !== "production"
        && base.protocol === "http:"
        && url.protocol === "http:"
        && ["127.0.0.1", "localhost", "::1"].includes(base.hostname)
        && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
      if ((url.protocol !== "https:" && !localHttp) || !url.pathname.startsWith(prefix)) return null;
      const segments = url.pathname.slice(prefix.length).split("/").map((segment) => decodeURIComponent(segment));
      if (!segments.length || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\"))) return null;
      const key = segments.join("/");
      mediaServerFilePath(key);
      return key;
    }
    const basePath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
    const localMockUrl = config?.allowLocalHttpPublicBaseUrl === true
      && base.protocol === "http:"
      && url.protocol === "http:"
      && ["127.0.0.1", "localhost", "::1"].includes(base.hostname)
      && ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
    if ((!localMockUrl && (base.protocol !== "https:" || url.protocol !== "https:")) || !url.pathname.startsWith(basePath)) return null;
    const segments = url.pathname.slice(basePath.length).split("/").map((segment) => decodeURIComponent(segment));
    if (!segments.length || segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\"))) return null;
    return segments.join("/");
  } catch {
    return null;
  }
}

function parseCropKey(value: unknown, asset: { organizationId: string; invitationId: string | null; id: string }) {
  if (typeof value !== "string" || !asset.invitationId) return null;
  const prefix = `private/pending/${asset.organizationId}/${asset.invitationId}/${asset.id}/`;
  return value.startsWith(prefix) ? value : null;
}

function expectedImageFormat(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpeg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return null;
}

async function bufferFromBody(body: { transformToByteArray(): Promise<Uint8Array> } | undefined) {
  return Buffer.from(await body?.transformToByteArray() ?? []);
}

export function parseMediaProcessingPayload(value: unknown): MediaProcessingPayload | null {
  if (!isRecord(value)
    || typeof value.mediaAssetId !== "string"
    || !/^[0-9a-f-]{36}$/i.test(value.mediaAssetId)
    || typeof value.processingStartedAt !== "string"
    || !Number.isFinite(Date.parse(value.processingStartedAt))) return null;
  return { mediaAssetId: value.mediaAssetId, processingStartedAt: value.processingStartedAt };
}

export function parseMediaEditProcessingPayload(value: unknown): MediaEditProcessingPayload | null {
  if (!isRecord(value)
    || typeof value.mediaAssetId !== "string"
    || !/^[0-9a-f-]{36}$/i.test(value.mediaAssetId)
    || typeof value.invitationId !== "string"
    || !/^[0-9a-f-]{36}$/i.test(value.invitationId)
    || typeof value.requestedById !== "string"
    || !/^[0-9a-f-]{36}$/i.test(value.requestedById)
    || typeof value.revisionKey !== "string"
    || !/^[0-9a-f-]{36}$/i.test(value.revisionKey)
    || typeof value.baseRevision !== "number"
    || !Number.isSafeInteger(value.baseRevision)
    || (value.baseRevision as number) < 0
    || typeof value.cropSizeBytes !== "number"
    || !Number.isSafeInteger(value.cropSizeBytes)
    || (value.cropSizeBytes as number) < 1
    || (value.cropSizeBytes as number) > 5_000_000
    || !isRecord(value.cropData)
    || typeof value.activeCoverKey !== "string"
    || !value.activeCoverKey.startsWith("invitations/")) return null;
  return {
    mediaAssetId: value.mediaAssetId,
    invitationId: value.invitationId,
    requestedById: value.requestedById,
    revisionKey: value.revisionKey,
    baseRevision: value.baseRevision as number,
    cropSizeBytes: value.cropSizeBytes as number,
    cropData: value.cropData,
    activeCoverKey: value.activeCoverKey,
  };
}

export async function processMediaAsset(
  prisma: PrismaClient,
  s3: S3Client | null,
  config: MediaProcessingConfig | null,
  payload: MediaProcessingPayload,
) {
  const processingStartedAt = new Date(payload.processingStartedAt);
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: payload.mediaAssetId },
    select: {
      id: true,
      storageProvider: true,
      organizationId: true,
      invitationId: true,
      storageKey: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      metadata: true,
      processingStartedAt: true,
    },
  });
  if (asset?.status !== "PROCESSING"
    || asset.processingStartedAt?.getTime() !== processingStartedAt.getTime()) return;

  const assetMetadata = isRecord(asset.metadata) ? asset.metadata : {};
  const storage = getMediaObjectStore(asset.storageProvider, s3, config);
  const mediaKind = assetMetadata.mediaKind === "gallery" || assetMetadata.mediaKind === "music" ? assetMetadata.mediaKind : "cover";
  const variantKey = mediaKind;
  const maxBytes = mediaKind === "music" ? 10_000_000 : 5_000_000;
  if (!asset.invitationId || asset.sizeBytes < BigInt(1) || asset.sizeBytes > BigInt(maxBytes)) {
    throw new InvalidMediaAssetError("Ukuran media tidak sesuai batas unggahan.");
  }

  if (mediaKind === "music") {
    const head = await storage.headPrivate(asset.storageKey);
    if (head.size !== Number(asset.sizeBytes) || head.size > maxBytes || (head.contentType && head.contentType !== "audio/mpeg")) {
      throw new InvalidMediaAssetError("Ukuran atau format audio tidak sesuai dengan file yang didaftarkan.");
    }
    const bytes = await storage.readPrivate(asset.storageKey);
    const hasId3Header = bytes.subarray(0, 3).toString("ascii") === "ID3";
    const hasMpegFrame = bytes.length > 1 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0;
    if (!bytes.length || bytes.length > maxBytes || BigInt(bytes.length) !== asset.sizeBytes || (!hasId3Header && !hasMpegFrame)) {
      throw new InvalidMediaAssetError("File ini bukan MP3 yang valid.");
    }

    const outputKey = `invitations/${asset.invitationId}/${asset.id}/music.mp3`;
    await storage.writePublic(outputKey, bytes, "audio/mpeg");
    await prisma.$transaction(async (tx) => {
      const changed = await tx.mediaAsset.updateMany({
        where: { id: asset.id, status: "PROCESSING", processingStartedAt },
        data: {
          status: "READY",
          visibility: "PRIVATE_SOURCE",
          processingStartedAt: null,
          metadata: { ...assetMetadata, publicKey: outputKey, sizeBytes: bytes.length },
        },
      });
      if (changed.count !== 1) return false;
      await tx.mediaVariant.upsert({
        where: { mediaAssetId_variantKey: { mediaAssetId: asset.id, variantKey } },
        create: { mediaAssetId: asset.id, variantKey, storageKey: outputKey, mimeType: "audio/mpeg", sizeBytes: BigInt(bytes.length) },
        update: { storageKey: outputKey, mimeType: "audio/mpeg", sizeBytes: BigInt(bytes.length), width: null, height: null },
      });
      return true;
    });
    return;
  }

  const sourceMimeType = expectedImageFormat(asset.mimeType);
  const cropKey = mediaKind === "gallery" ? null : parseCropKey(assetMetadata.cropKey, asset);
  const cropSizeBytes = Number(assetMetadata.cropSizeBytes);
  const cropMimeType = assetMetadata.cropMimeType;
  if (!sourceMimeType) throw new InvalidMediaAssetError("Format file sumber tidak sesuai.");
  if (mediaKind !== "gallery" && (!cropKey
    || !Number.isSafeInteger(cropSizeBytes)
    || cropSizeBytes < 1
    || cropSizeBytes > maxBytes
    || (cropMimeType !== "image/png" && cropMimeType !== "image/webp"))) {
    throw new InvalidMediaAssetError("Foto ini tidak memiliki data crop yang valid.");
  }

  const [originalHead, cropHead] = await Promise.all([
    storage.headPrivate(asset.storageKey),
    cropKey ? storage.headPrivate(cropKey) : Promise.resolve(null),
  ]);
  if (originalHead.size !== Number(asset.sizeBytes)
    || (originalHead.size ?? 0) > maxBytes
    || (cropKey && (cropHead?.size !== cropSizeBytes || (cropHead?.size ?? 0) > maxBytes))) {
    throw new InvalidMediaAssetError("Ukuran file tidak sesuai dengan unggahan yang didaftarkan.");
  }
  const [originalBuffer, cropBuffer] = await Promise.all([
    storage.readPrivate(asset.storageKey),
    cropKey ? storage.readPrivate(cropKey) : Promise.resolve(null),
  ]);
  const sourceBuffer = cropBuffer ?? originalBuffer;
  if (!originalBuffer.length || originalBuffer.length > maxBytes || BigInt(originalBuffer.length) !== asset.sizeBytes
    || !sourceBuffer.length || sourceBuffer.length > maxBytes
    || (cropKey && sourceBuffer.length !== cropSizeBytes)) {
    throw new InvalidMediaAssetError("Ukuran file tidak sesuai dengan unggahan yang didaftarkan.");
  }

  let originalMetadata: ImageMetadata;
  let cropMetadata: ImageMetadata;
  let output: OptimizedImage;
  try {
    originalMetadata = await sharp(originalBuffer, { limitInputPixels: 40_000_000, animated: false }).metadata();
    cropMetadata = await sharp(sourceBuffer, { limitInputPixels: 40_000_000, animated: false }).metadata();
    const expectedCropFormat = mediaKind === "gallery" ? sourceMimeType : cropMimeType === "image/png" ? "png" : "webp";
    if (originalMetadata.format !== sourceMimeType || !originalMetadata.width || !originalMetadata.height || (originalMetadata.pages ?? 1) > 1
      || cropMetadata.format !== expectedCropFormat || !cropMetadata.width || !cropMetadata.height || (cropMetadata.pages ?? 1) > 1) {
      throw new InvalidMediaAssetError("Format atau dimensi foto tidak sesuai.");
    }
    output = await sharp(sourceBuffer, { limitInputPixels: 40_000_000, animated: false })
      .autoOrient()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    if (error instanceof InvalidMediaAssetError) throw error;
    throw new InvalidMediaAssetError("Foto tidak dapat dibaca atau diproses.");
  }

  const outputKey = `invitations/${asset.invitationId}/${asset.id}/${variantKey}.webp`;
  let thumbnail: OptimizedImage;
  try {
    thumbnail = await sharp(sourceBuffer, { limitInputPixels: 40_000_000, animated: false })
      .autoOrient()
      .resize({ width: 480, height: 640, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 76 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new InvalidMediaAssetError("Thumbnail foto tidak dapat dibuat.");
  }
  const thumbnailKey = `invitations/${asset.invitationId}/${asset.id}/${variantKey}-thumbnail.webp`;
  await storage.writePublic(outputKey, output.data, "image/webp");
  await storage.writePublic(thumbnailKey, thumbnail.data, "image/webp");
  const { cropKey: _cropKey, ...persistentMetadata } = assetMetadata;
  const published = await prisma.$transaction(async (tx) => {
    const changed = await tx.mediaAsset.updateMany({
      where: { id: asset.id, status: "PROCESSING", processingStartedAt },
      data: {
        status: "READY",
        visibility: "PRIVATE_SOURCE",
        processingStartedAt: null,
        metadata: {
          ...persistentMetadata,
          sourceWidth: originalMetadata.width,
          sourceHeight: originalMetadata.height,
          cropWidth: cropMetadata.width,
          cropHeight: cropMetadata.height,
          width: output.info.width,
          height: output.info.height,
          publicKey: outputKey,
        },
      },
    });
    if (changed.count !== 1) return false;
    await tx.mediaVariant.upsert({
      where: { mediaAssetId_variantKey: { mediaAssetId: asset.id, variantKey } },
      create: { mediaAssetId: asset.id, variantKey, storageKey: outputKey, mimeType: "image/webp", sizeBytes: BigInt(output.info.size), width: output.info.width, height: output.info.height },
      update: { storageKey: outputKey, mimeType: "image/webp", sizeBytes: BigInt(output.info.size), width: output.info.width, height: output.info.height },
    });
    await tx.mediaVariant.upsert({
      where: { mediaAssetId_variantKey: { mediaAssetId: asset.id, variantKey: `${variantKey}-thumbnail` } },
      create: { mediaAssetId: asset.id, variantKey: `${variantKey}-thumbnail`, storageKey: thumbnailKey, mimeType: "image/webp", sizeBytes: BigInt(thumbnail.info.size), width: thumbnail.info.width, height: thumbnail.info.height },
      update: { storageKey: thumbnailKey, mimeType: "image/webp", sizeBytes: BigInt(thumbnail.info.size), width: thumbnail.info.width, height: thumbnail.info.height },
    });
    return true;
  });
  if (published && cropKey) await storage.deletePrivate(cropKey).catch(() => undefined);
}

export async function processMediaEdit(
  prisma: PrismaClient,
  s3: S3Client | null,
  config: MediaProcessingConfig | null,
  payload: MediaEditProcessingPayload,
) {
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id: payload.mediaAssetId,
      invitationId: payload.invitationId,
      uploadedById: payload.requestedById,
      status: "READY",
      deletedAt: null,
    },
    select: {
      id: true,
      storageProvider: true,
      organizationId: true,
      invitationId: true,
      uploadedById: true,
      metadata: true,
      invitation: { select: { draftData: true } },
      edits: { orderBy: { revision: "desc" }, take: 1, select: { revision: true } },
      variants: { where: { variantKey: "cover" }, select: { storageKey: true } },
    },
  });
  if (!asset?.invitationId) throw new InvalidMediaAssetError("Foto sampul tidak lagi dapat diedit.");
  const storage = getMediaObjectStore(asset.storageProvider, s3, config);

  const outputKey = `invitations/${payload.invitationId}/${asset.id}/cover-${payload.revisionKey}.webp`;
  const invitationData = isRecord(asset.invitation?.draftData) ? asset.invitation.draftData : null;
  const currentCoverKey = mediaKeyFromUrlForWorker(asset.storageProvider, config, typeof invitationData?.coverPhoto === "string" ? invitationData.coverPhoto : "");
  const existingRevision = await prisma.mediaEdit.findUnique({
    where: { mediaAssetId_revision: { mediaAssetId: asset.id, revision: payload.baseRevision + 1 } },
    select: { revision: true },
  });
  if (existingRevision) {
    if (currentCoverKey === outputKey && asset.variants.some((variant) => variant.storageKey === outputKey)) {
      return { publicUrl: mediaPublicUrlForWorker(asset.storageProvider, outputKey, config), revision: existingRevision.revision };
    }
    throw new InvalidMediaAssetError("Foto berubah di sesi lain. Muat ulang editor lalu coba lagi.");
  }
  if (currentCoverKey !== payload.activeCoverKey
    || !asset.variants.some((variant) => variant.storageKey === payload.activeCoverKey)
    || (asset.edits[0]?.revision ?? 0) !== payload.baseRevision) {
    throw new InvalidMediaAssetError("Foto berubah di sesi lain. Muat ulang editor lalu coba lagi.");
  }

  const cropKey = `private/pending/${asset.organizationId}/${payload.invitationId}/${asset.id}/edits/${payload.revisionKey}.webp`;
  const head = await storage.headPrivate(cropKey);
  if (head.size !== payload.cropSizeBytes || (head.contentType && head.contentType !== "image/webp")) {
    throw new InvalidMediaAssetError("Ukuran atau format foto tidak sesuai.");
  }
  const bytes = await storage.readPrivate(cropKey);
  if (!bytes.length || bytes.length !== payload.cropSizeBytes || bytes.length > 5_000_000) {
    throw new InvalidMediaAssetError("Ukuran file foto tidak sesuai.");
  }

  let metadata: ImageMetadata;
  let output: OptimizedImage;
  try {
    const input = sharp(bytes, { limitInputPixels: 40_000_000, animated: false });
    metadata = await input.metadata();
    if (metadata.format !== "webp" || !metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
      throw new InvalidMediaAssetError("Format foto tidak sesuai.");
    }
    output = await sharp(bytes, { limitInputPixels: 40_000_000, animated: false })
      .autoOrient()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
  } catch (error) {
    if (error instanceof InvalidMediaAssetError) throw error;
    throw new InvalidMediaAssetError("Foto tidak dapat dibaca atau diproses.");
  }

  await storage.writePublic(outputKey, output.data, "image/webp");
  let thumbnail: OptimizedImage;
  try {
    thumbnail = await sharp(bytes, { limitInputPixels: 40_000_000, animated: false })
      .autoOrient()
      .resize({ width: 480, height: 640, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 76 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new InvalidMediaAssetError("Thumbnail foto tidak dapat dibuat.");
  }
  const thumbnailKey = `invitations/${payload.invitationId}/${asset.id}/cover-thumbnail-${payload.revisionKey}.webp`;
  await storage.writePublic(thumbnailKey, thumbnail.data, "image/webp");
  const metadataRecord = isRecord(asset.metadata) ? asset.metadata : {};
  const publicUrlValue = mediaPublicUrlForWorker(asset.storageProvider, outputKey, config);
  await prisma.$transaction(async (tx) => {
    const currentInvitation = await tx.invitation.findFirst({
      where: { id: payload.invitationId, ownerId: payload.requestedById, deletedAt: null, status: { in: ["DRAFT", "PUBLISHED"] } },
      select: { draftData: true, updatedAt: true },
    });
    const currentDraftData = isRecord(currentInvitation?.draftData) ? currentInvitation.draftData : null;
    const transactionCoverKey = mediaKeyFromUrlForWorker(asset.storageProvider, config, typeof currentDraftData?.coverPhoto === "string" ? currentDraftData.coverPhoto : "");
    const latestEdit = await tx.mediaEdit.findFirst({
      where: { mediaAssetId: asset.id },
      orderBy: { revision: "desc" },
      select: { revision: true },
    });
    const activeVariant = await tx.mediaVariant.findUnique({
      where: { mediaAssetId_variantKey: { mediaAssetId: asset.id, variantKey: "cover" } },
      select: { storageKey: true },
    });
    if (!currentInvitation
      || transactionCoverKey !== payload.activeCoverKey
      || activeVariant?.storageKey !== payload.activeCoverKey
      || (latestEdit?.revision ?? 0) !== payload.baseRevision) {
      throw new InvalidMediaAssetError("Foto berubah di sesi lain. Muat ulang editor lalu coba lagi.");
    }
    await tx.mediaEdit.create({
      data: { mediaAssetId: asset.id, revision: payload.baseRevision + 1, editData: JSON.parse(JSON.stringify(payload.cropData)) },
    });
    await tx.mediaVariant.update({
      where: { mediaAssetId_variantKey: { mediaAssetId: asset.id, variantKey: "cover" } },
      data: { storageKey: outputKey, mimeType: "image/webp", sizeBytes: BigInt(output.info.size), width: output.info.width, height: output.info.height },
    });
    await tx.mediaVariant.upsert({
      where: { mediaAssetId_variantKey: { mediaAssetId: asset.id, variantKey: "cover-thumbnail" } },
      create: { mediaAssetId: asset.id, variantKey: "cover-thumbnail", storageKey: thumbnailKey, mimeType: "image/webp", sizeBytes: BigInt(thumbnail.info.size), width: thumbnail.info.width, height: thumbnail.info.height },
      update: { storageKey: thumbnailKey, mimeType: "image/webp", sizeBytes: BigInt(thumbnail.info.size), width: thumbnail.info.width, height: thumbnail.info.height },
    });
    await tx.mediaAsset.update({
      where: { id: asset.id },
      data: { metadata: { ...metadataRecord, cropWidth: metadata.width, cropHeight: metadata.height, width: output.info.width, height: output.info.height, publicKey: outputKey } },
    });
    const invitationUpdate = await tx.invitation.updateMany({
      where: { id: payload.invitationId, ownerId: payload.requestedById, status: { in: ["DRAFT", "PUBLISHED"] }, updatedAt: currentInvitation.updatedAt },
      data: { draftData: JSON.parse(JSON.stringify({ ...currentDraftData, coverPhoto: publicUrlValue })) },
    });
    if (invitationUpdate.count !== 1) throw new InvalidMediaAssetError("Undangan berubah saat edit foto diproses. Muat ulang editor lalu coba lagi.");
  });
  await storage.deletePrivate(cropKey).catch(() => undefined);
  return { publicUrl: publicUrlValue, revision: payload.baseRevision + 1 };
}

export async function failMediaProcessing(
  prisma: PrismaClient,
  s3: S3Client | null,
  config: MediaProcessingConfig | null,
  payload: MediaProcessingPayload,
) {
  const processingStartedAt = new Date(payload.processingStartedAt);
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: payload.mediaAssetId },
    select: { id: true, organizationId: true, invitationId: true, storageProvider: true, status: true, metadata: true, processingStartedAt: true },
  });
  if (asset?.status !== "PROCESSING"
    || asset.processingStartedAt?.getTime() !== processingStartedAt.getTime()) return;
  const assetMetadata = isRecord(asset.metadata) ? asset.metadata : {};
  const mediaKind = assetMetadata.mediaKind === "gallery" || assetMetadata.mediaKind === "music" ? assetMetadata.mediaKind : "cover";
  const variantKey = mediaKind;
  const failed = await prisma.mediaAsset.updateMany({
    where: { id: asset.id, status: "PROCESSING", processingStartedAt },
    data: { status: "FAILED", processingStartedAt: null },
  });
  if (!failed.count || !asset.invitationId) return;
  let storage: MediaObjectStore;
  try {
    storage = getMediaObjectStore(asset.storageProvider, s3, config);
  } catch {
    return;
  }
  const pendingCropKey = parseCropKey(assetMetadata.cropKey, asset);
  const publicKey = mediaKind === "music"
    ? `invitations/${asset.invitationId}/${asset.id}/music.mp3`
    : `invitations/${asset.invitationId}/${asset.id}/${variantKey}.webp`;
  const thumbnailKey = mediaKind === "music" ? null : `invitations/${asset.invitationId}/${asset.id}/${variantKey}-thumbnail.webp`;
  await Promise.all([
    storage.deletePublic(publicKey).catch(() => undefined),
    thumbnailKey ? storage.deletePublic(thumbnailKey).catch(() => undefined) : Promise.resolve(),
    pendingCropKey ? storage.deletePrivate(pendingCropKey).catch(() => undefined) : Promise.resolve(),
  ]);
}

export async function failMediaEdit(
  prisma: PrismaClient,
  s3: S3Client | null,
  config: MediaProcessingConfig | null,
  payload: MediaEditProcessingPayload,
) {
  const asset = await prisma.mediaAsset.findFirst({
    where: { id: payload.mediaAssetId, invitationId: payload.invitationId, uploadedById: payload.requestedById },
    select: { id: true, organizationId: true, storageProvider: true },
  });
  if (!asset) return;
  let storage: MediaObjectStore;
  try {
    storage = getMediaObjectStore(asset.storageProvider, s3, config);
  } catch {
    return;
  }
  const cropKey = `private/pending/${asset.organizationId}/${payload.invitationId}/${asset.id}/edits/${payload.revisionKey}.webp`;
  const outputKey = `invitations/${payload.invitationId}/${asset.id}/cover-${payload.revisionKey}.webp`;
  const committed = await prisma.mediaEdit.findUnique({
    where: { mediaAssetId_revision: { mediaAssetId: asset.id, revision: payload.baseRevision + 1 } },
    select: { id: true },
  });
  if (committed) {
    await storage.deletePrivate(cropKey).catch(() => undefined);
    return;
  }
  const thumbnailKey = `invitations/${payload.invitationId}/${asset.id}/cover-thumbnail-${payload.revisionKey}.webp`;
  await Promise.all([
    storage.deletePrivate(cropKey).catch(() => undefined),
    storage.deletePublic(outputKey).catch(() => undefined),
    storage.deletePublic(thumbnailKey).catch(() => undefined),
  ]);
}
