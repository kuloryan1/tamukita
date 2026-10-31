import { randomUUID } from "node:crypto";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { expect, test, vi } from "vitest";
import type { PrismaClient } from "../generated/prisma/client";
import { deletePaparazziPhotoObjects, failPaparazziPhoto, processPaparazziPhoto } from "./paparazzi-processing";
import { paparazziServerStore } from "./paparazzi-server-files";

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
    expect(image).toMatchObject({ format: "jpeg", width: 60, height: 90 }); expect(image.exif).toBeUndefined();
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
