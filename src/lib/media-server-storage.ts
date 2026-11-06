import { constants } from "node:fs";
import { access, lstat, mkdir, open, realpath, rename, statfs, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";

const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const storageKeyPattern = new RegExp(
  `^(?:originals/${uuid}/${uuid}/${uuid}/(?:source\\.(?:jpg|png|webp)|gallery-source\\.(?:jpg|png|webp)|music-source\\.mp3)`
  + `|private/pending/${uuid}/${uuid}/${uuid}/(?:cover\\.(?:png|webp)|edits/${uuid}\\.webp)`
  + `|invitations/${uuid}/${uuid}/(?:cover\\.webp|gallery\\.webp|music\\.mp3|cover-thumbnail\\.webp|gallery-thumbnail\\.webp|cover-${uuid}\\.webp|cover-thumbnail-${uuid}\\.webp))$`,
  "i",
);

export class MediaStorageFullError extends Error {
  constructor() {
    super("Penyimpanan server hampir penuh.");
    this.name = "MediaStorageFullError";
  }
}

export class MediaUploadTooLargeError extends Error {
  constructor() {
    super("Ukuran file melewati batas unggahan.");
    this.name = "MediaUploadTooLargeError";
  }
}

export function mediaStorageDirectory(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const root = env.MEDIA_STORAGE_DIR || (env.NODE_ENV === "production" ? "/data/media" : path.resolve(".local-storage/media"));
  if (!path.isAbsolute(root) || path.parse(root).root === root) throw new Error("Media perlu memakai direktori penyimpanan khusus yang absolut.");
  return root;
}

export function mediaServerFilePath(key: string, root = mediaStorageDirectory()) {
  if (!storageKeyPattern.test(key)) throw new Error("Kunci penyimpanan media tidak valid.");
  const destination = path.resolve(root, key);
  if (!destination.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("Lokasi penyimpanan media tidak valid.");
  return destination;
}

async function ensureMediaDirectory() {
  const root = mediaStorageDirectory();
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (await realpath(root) !== path.resolve(root)) throw new Error("Direktori media tidak boleh berupa symbolic link.");
  await access(root, constants.R_OK | constants.W_OK);
  return root;
}

async function ensureNoLinkedParents(filePath: string, root: string) {
  const relative = path.relative(root, path.dirname(filePath));
  let current = root;
  for (const segment of relative.split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    await mkdir(current, { recursive: true, mode: 0o700 });
    const info = await lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Direktori media tidak valid.");
  }
}

export function mediaServerStore() {
  return {
    async head(key: string) {
      const info = await lstat(mediaServerFilePath(key));
      if (!info.isFile() || info.isSymbolicLink()) throw new Error("File media tidak valid.");
      return { size: info.size };
    },
    async read(key: string) {
      const file = await open(mediaServerFilePath(key), constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        if (!(await file.stat()).isFile()) throw new Error("File media tidak valid.");
        return await file.readFile();
      } finally {
        await file.close();
      }
    },
    async stream(key: string, signal?: AbortSignal): Promise<ReadableStream<Uint8Array>> {
      const file = await open(mediaServerFilePath(key), constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        if (!(await file.stat()).isFile()) throw new Error("File media tidak valid.");
        return Readable.toWeb(file.createReadStream({ autoClose: true, signal })) as ReadableStream<Uint8Array>;
      } catch (error) {
        await file.close();
        throw error;
      }
    },
    async write(key: string, bytes: Buffer) {
      const root = await ensureMediaDirectory();
      const reserve = Number(process.env.MEDIA_MIN_FREE_BYTES ?? 536_870_912);
      if (!Number.isSafeInteger(reserve) || reserve < 0) throw new Error("Pengaturan ruang kosong media tidak valid.");
      const info = await statfs(root);
      if (info.bavail * info.bsize < reserve + bytes.length) throw new MediaStorageFullError();
      const destination = mediaServerFilePath(key, root);
      await ensureNoLinkedParents(destination, root);
      const temporaryDirectory = path.join(root, ".tmp");
      await mkdir(temporaryDirectory, { recursive: true, mode: 0o700 });
      const temporary = path.join(temporaryDirectory, `${randomUUID()}.tmp`);
      try {
        const file = await open(temporary, "wx", 0o600);
        try {
          await file.writeFile(bytes);
          await file.sync();
        } finally {
          await file.close();
        }
        await rename(temporary, destination);
      } catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
      }
    },
    async delete(key: string) {
      await unlink(mediaServerFilePath(key)).catch((error) => {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") return;
        throw error;
      });
    },
  };
}

export async function readMediaRequestBody(request: Request, maxBytes: number) {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (!Number.isSafeInteger(declared) || declared < 1 || declared > maxBytes) throw new MediaUploadTooLargeError();
  }
  if (!request.body) throw new Error("File unggahan kosong.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new MediaUploadTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!total) throw new Error("File unggahan kosong.");
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
}
