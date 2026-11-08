import { randomUUID } from "node:crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { expect, test } from "vitest";
import type { PrismaClient } from "../generated/prisma/client";
import { deletePaparazziPhotoObjects, processPaparazziPhoto } from "./paparazzi-processing";
import { PAPARAZZI_STORY_LAYOUT_VERSION, renderPaparazziStory } from "./paparazzi-story";

async function fixture({ duplicate = false, deleteDuringPut = false, deleteAfterCommit = false } = {}) {
  const source = await sharp({ create: { width: 100, height: 70, channels: 3, background: "#69876a" } }).jpeg().toBuffer();
  const id = randomUUID(); const organizationId = randomUUID(); const invitationId = randomUUID(); const startedAt = new Date();
  const prefix = `${organizationId}/${invitationId}/${id}`;
  const state = { id, storageProvider: "R2" as const, createdAt: startedAt, sourceKey: `private/pending/paparazzi/${prefix}/input.jpg`, processedKey: `private/paparazzi/${prefix}.jpg`, mimeType: "image/jpeg", sizeBytes: BigInt(source.length), instagramHandle: "@guest_qa", status: "PROCESSING", deletedAt: null as Date | null, storageDeletedAt: null as Date | null, processingStartedAt: startedAt as Date | null, retentionAt: new Date(Date.now() + 86_400_000), receiptHash: "test-only-hash", guardianConsentAt: null, guardianConsentVersion: null, album: { invitation: { id: invitationId, organizationId } } };
  const objects = new Map<string, Buffer>([[state.sourceKey, source]]);
  let readyRelease: () => void = () => {};
  const committed = new Promise<void>(resolve => { readyRelease = resolve; });
  const prisma = { paparazziPhoto: {
    findUnique: async () => ({ ...state }),
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      if (where.status && where.status !== state.status) return { count: 0 };
      if (where.deletedAt === null && state.deletedAt) return { count: 0 };
      if (where.storageDeletedAt === null && state.storageDeletedAt) return { count: 0 };
      if (where.processingStartedAt instanceof Date && where.processingStartedAt.getTime() !== state.processingStartedAt?.getTime()) return { count: 0 };
      Object.assign(state, data); if (data.status === "READY") readyRelease(); return { count: 1 };
    },
  } } as unknown as PrismaClient;
  let release: () => void = () => {};
  const bothReading = new Promise<void>(resolve => { release = resolve; });
  let readers = 0; let puts = 0; let failLateDelete = deleteDuringPut;
  const s3 = { send: async (command: HeadObjectCommand | GetObjectCommand | PutObjectCommand | DeleteObjectCommand) => {
    const key = command.input.Key ?? "";
    if (command instanceof HeadObjectCommand) return { ContentType: "image/jpeg", ContentLength: objects.get(key)?.length };
    if (command instanceof GetObjectCommand) {
      const bytes = objects.get(key); if (!bytes) throw new Error("Missing source");
      if (duplicate) { readers += 1; if (readers === 2) release(); await bothReading; }
      return { Body: { transformToWebStream: () => new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close(); } }) } };
    }
    if (command instanceof PutObjectCommand) {
      puts += 1;
      if (deleteAfterCommit && puts === 2) {
        await committed; state.status = "DELETED"; state.deletedAt = new Date();
        await deletePaparazziPhotoObjects(prisma, s3, "private", id);
      }
      if (deleteDuringPut) {
        state.status = "DELETED"; state.deletedAt = new Date();
        // The owner deletion finishes while an earlier R2 write is still in flight.
        await deletePaparazziPhotoObjects(prisma, s3, "private", id);
      }
      objects.set(key, Buffer.from(command.input.Body as Uint8Array)); return {};
    }
    if (command instanceof DeleteObjectCommand) {
      if (failLateDelete && key === state.processedKey && objects.has(key)) { failLateDelete = false; throw new Error("Temporary R2 deletion failure"); }
      objects.delete(key); return {};
    }
    throw new Error("Unexpected storage command");
  } } as unknown as S3Client;
  return { state, objects, prisma, s3, payload: { photoId: id, processingStartedAt: startedAt.toISOString() } };
}

test("duplicate worker delivery preserves the committed public image", async () => {
  const f = await fixture({ duplicate: true });
  await Promise.all([processPaparazziPhoto(f.prisma, f.s3, "private", f.payload), processPaparazziPhoto(f.prisma, f.s3, "private", f.payload)]);
  expect(f.state.status).toBe("READY");
  expect(f.objects.has(f.state.processedKey)).toBe(true);
  expect(await sharp(f.objects.get(f.state.processedKey)).metadata()).toMatchObject({ format: "jpeg", width: 1080, height: 1920 });
  expect(f.state).toMatchObject({ storyKey: f.state.processedKey, storyLayoutVersion: PAPARAZZI_STORY_LAYOUT_VERSION, width: 1080, height: 1920 });
  expect(f.objects.has(f.state.sourceKey)).toBe(false);
});

test.each([
  { background: "#191a1c", ink: "white" },
  { background: "#f0e4b1", ink: "black" },
])("Story JPEG centres only the larger $ink WR crest", async ({ background, ink }) => {
  const image = sharp({ create: { width: 300, height: 200, channels: 3, background } });
  const story = await renderPaparazziStory(image);
  expect(story.info).toMatchObject({ width: 1080, height: 1920, format: "jpeg" });
  const { data, info } = await sharp(story.data).extract({ left: 300, top: 780, width: 480, height: 360 })
    .removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width; let right = -1; let top = info.height; let bottom = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      const offset = (y * info.width + x) * info.channels;
      const [red, green, blue] = data.subarray(offset, offset + 3);
      const visible = ink === "white" ? Math.min(red, green, blue) >= 225 : Math.max(red, green, blue) <= 35;
      if (visible) { left = Math.min(left, x); right = x; top = Math.min(top, y); bottom = y; }
    }
  }
  expect(right - left).toBeGreaterThan(100);
  expect(bottom - top).toBeGreaterThan(100);
  expect(Math.abs(300 + (left + right) / 2 - 540)).toBeLessThan(8);
  expect(Math.abs(780 + (top + bottom) / 2 - 960)).toBeLessThan(8);
});

test("deletion stays eligible for retry when an in-flight write arrives after owner cleanup", async () => {
  const f = await fixture({ deleteDuringPut: true });
  await expect(processPaparazziPhoto(f.prisma, f.s3, "private", f.payload)).rejects.toThrow("Temporary R2 deletion failure");
  expect(f.state.status).toBe("DELETED");
  expect(f.state.storageDeletedAt).toBeNull();
  await deletePaparazziPhotoObjects(f.prisma, f.s3, "private", f.state.id);
  expect(f.objects.has(f.state.processedKey)).toBe(false);
  expect(f.objects.has(f.state.sourceKey)).toBe(false);
  expect(f.state.instagramHandle).toBeNull();
  f.state.deletedAt = new Date(Date.now() - 2 * 60 * 60 * 1_000);
  f.state.createdAt = new Date(Date.now() - 3 * 60 * 60 * 1_000);
  f.state.processingStartedAt = new Date(Date.now() - 3 * 60 * 60 * 1_000);
  await deletePaparazziPhotoObjects(f.prisma, f.s3, "private", f.state.id);
  expect(f.state.storageDeletedAt).not.toBeNull();
});

test("an unfinished signed upload arriving after deletion remains eligible for cleanup", async () => {
  const f = await fixture(); const bytes = f.objects.get(f.state.sourceKey);
  f.state.processingStartedAt = null; f.state.status = "DELETED"; f.state.deletedAt = new Date();
  await deletePaparazziPhotoObjects(f.prisma, f.s3, "private", f.state.id);
  expect(f.state.storageDeletedAt).toBeNull();
  if (!bytes) throw new Error("Missing fixture image");
  f.objects.set(f.state.sourceKey, bytes);
  await deletePaparazziPhotoObjects(f.prisma, f.s3, "private", f.state.id);
  expect(f.objects.has(f.state.sourceKey)).toBe(false);
});

test("a duplicate still writing after READY cannot resurrect an owner-deleted photo", async () => {
  const f = await fixture({ duplicate: true, deleteAfterCommit: true });
  await Promise.all([processPaparazziPhoto(f.prisma, f.s3, "private", f.payload), processPaparazziPhoto(f.prisma, f.s3, "private", f.payload)]);
  expect(f.state.status).toBe("DELETED");
  expect(f.objects.has(f.state.processedKey)).toBe(false);
  expect(f.state.storageDeletedAt).toBeNull();
});
