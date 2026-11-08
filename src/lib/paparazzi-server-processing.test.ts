import { randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { expect, test, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client";
import { deletePaparazziPhotoObjects, failPaparazziPhoto, processPaparazziPhoto, upgradePaparazziStoryPhotos } from "./paparazzi-processing";
import { paparazziServerStore } from "./paparazzi-server-files";
import { PAPARAZZI_STORY_LAYOUT_VERSION } from "./paparazzi-story";

test("the worker processes, retries cleanup, and deletes server photos without any R2 client", async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "tamukita-paparazzi-worker-")));
  vi.stubEnv("PAPARAZZI_STORAGE_DIR", root); vi.stubEnv("PAPARAZZI_MIN_FREE_BYTES", "0");
  try {
    const id = randomUUID(); const organizationId = randomUUID(); const invitationId = randomUUID(); const startedAt = new Date();
    const prefix = `${organizationId}/${invitationId}/${id}`;
    const source = await sharp({ create: { width: 90, height: 60, channels: 3, background: "#8ca18a" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const state = { id, storageProvider: "SERVER", status: "PROCESSING", sourceKey: `private/pending/paparazzi/${prefix}/source`, processedKey: `private/paparazzi/${prefix}.jpg`, sizeBytes: BigInt(source.length), mimeType: "image/jpeg", createdAt: startedAt, processingStartedAt: startedAt, deletedAt: null as Date | null, storageDeletedAt: null as Date | null, retentionAt: new Date(Date.now() + 86_400_000), album: { invitation: { id: invitationId, organizationId } } };
    const prisma = { paparazziPhoto: { findUnique: async () => ({ ...state }), updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (where.status && where.status !== state.status) return { count: 0 };
      if (where.deletedAt === null && state.deletedAt) return { count: 0 };
      Object.assign(state, data); return { count: 1 };
    } } } as unknown as PrismaClient;
    const payload = { photoId: id, processingStartedAt: startedAt.toISOString() };
    await paparazziServerStore().write(state.sourceKey, source, state.mimeType, true);
    await processPaparazziPhoto(prisma, null, undefined, payload);
    expect(state.status).toBe("READY");
    const image = await sharp(Buffer.from(await new Response(await paparazziServerStore().read(state.processedKey)).arrayBuffer())).metadata();
    expect(image).toMatchObject({ format: "jpeg", width: 1080, height: 1920 }); expect(image.exif).toBeUndefined();
    await expect(paparazziServerStore().head(state.sourceKey)).rejects.toMatchObject({ code: "ENOENT" });
    // A retry after a temporary source-delete error must still remove the raw image.
    await paparazziServerStore().write(state.sourceKey, source, state.mimeType, true);
    await processPaparazziPhoto(prisma, null, undefined, payload);
    await expect(paparazziServerStore().head(state.sourceKey)).rejects.toMatchObject({ code: "ENOENT" });
    state.status = "DELETED"; state.deletedAt = new Date(Date.now() - 7_200_000); state.createdAt = new Date(Date.now() - 10_800_000);
    await deletePaparazziPhotoObjects(prisma, null, undefined, id);
    expect(state.storageDeletedAt).toBeInstanceOf(Date);
    await expect(paparazziServerStore().head(state.processedKey)).rejects.toMatchObject({ code: "ENOENT" });
    state.status = "PROCESSING"; state.deletedAt = null; state.storageDeletedAt = null;
    await paparazziServerStore().write(state.sourceKey, Buffer.from("invalid image"), state.mimeType, true);
    await failPaparazziPhoto(prisma, null, undefined, payload);
    expect(state.status).toBe("FAILED");
    await expect(paparazziServerStore().head(state.sourceKey)).rejects.toMatchObject({ code: "ENOENT" });
  } finally { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); }
});

test("an existing album image gets a Story variant while the saved JPEG is kept for retention cleanup", async () => {
  const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "tamukita-paparazzi-story-")));
  vi.stubEnv("PAPARAZZI_STORAGE_DIR", root); vi.stubEnv("PAPARAZZI_MIN_FREE_BYTES", "0");
  try {
    const id = randomUUID();
    const prefix = `${randomUUID()}/${randomUUID()}/${id}`;
    const state = {
      id, storageProvider: "SERVER", storyKey: null as string | null, storyLayoutVersion: 0, instagramHandle: "@guest_qa",
      status: "READY", processedKey: `private/paparazzi/${prefix}.jpg`, sourceKey: `private/pending/paparazzi/${prefix}/source`,
      createdAt: new Date(Date.now() - 86_400_000), processingStartedAt: null, deletedAt: null as Date | null, storageDeletedAt: null,
    };
    const photoModel = {
      findMany: async () => state.deletedAt || (state.storyKey && state.storyLayoutVersion >= PAPARAZZI_STORY_LAYOUT_VERSION) ? [] : [{ ...state }],
      findUnique: async () => ({ ...state }),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => { Object.assign(state, data); return { count: 1 }; },
    };
    const prisma = { paparazziPhoto: photoModel, $transaction: async (work: (tx: { paparazziPhoto: typeof photoModel }) => Promise<void>) => work({ paparazziPhoto: photoModel }) } as unknown as PrismaClient;
    const storage = paparazziServerStore();
    const original = await sharp({ create: { width: 320, height: 240, channels: 3, background: "#363a34" } }).jpeg().toBuffer();
    await storage.write(state.processedKey, original, "image/jpeg");
    await upgradePaparazziStoryPhotos(prisma, null);
    const storyKey = state.storyKey;
    expect(storyKey).toMatch(/-story-v1\.jpg$/);
    if (!storyKey) throw new Error("Story variant was not written");
    const read = async (key: string) => Buffer.from(await new Response(await storage.read(key)).arrayBuffer());
    expect(await read(state.processedKey)).toEqual(original);
    expect(await sharp(await read(storyKey)).metadata()).toMatchObject({ width: 1080, height: 1920 });
    expect(state.storyLayoutVersion).toBe(PAPARAZZI_STORY_LAYOUT_VERSION);
    const oldStory = await sharp(await read(storyKey)).composite([
      { input: { create: { width: 40, height: 40, channels: 3, background: "#fff" } }, left: 520, top: 1760 },
    ]).jpeg().toBuffer();
    await storage.write(storyKey, oldStory, "image/jpeg");
    state.storyLayoutVersion = 1;
    await upgradePaparazziStoryPhotos(prisma, null);
    expect(state.storyKey).toBe(storyKey);
    expect(state.storyLayoutVersion).toBe(PAPARAZZI_STORY_LAYOUT_VERSION);
    const updated = await read(storyKey);
    const clearedPixel = await sharp(updated).extract({ left: 540, top: 1780, width: 1, height: 1 }).raw().toBuffer();
    expect(Math.max(...clearedPixel)).toBeLessThan(70);
    expect(await read(state.processedKey)).toEqual(original);
    await upgradePaparazziStoryPhotos(prisma, null);
    expect(await read(storyKey)).toEqual(updated);
    state.deletedAt = new Date();
    await deletePaparazziPhotoObjects(prisma, null, undefined, id);
    await expect(storage.head(state.processedKey)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(storage.head(storyKey)).rejects.toMatchObject({ code: "ENOENT" });
  } finally { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); }
});
