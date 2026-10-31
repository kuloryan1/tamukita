import { constants } from "node:fs";
import { access, link, lstat, mkdir, open, realpath, rename, rm, statfs, unlink, writeFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";

export class PaparazziDiskFullError extends Error {}
export class PaparazziUploadConflictError extends Error {}

export function paparazziStorageDirectory(env: Partial<NodeJS.ProcessEnv> = process.env) {
  const root = env.PAPARAZZI_STORAGE_DIR || (env.NODE_ENV === "production" ? "/data/paparazzi" : path.resolve(".local-storage/paparazzi"));
  if (!path.isAbsolute(root) || path.parse(root).root === root) throw new Error("Paparazi needs an absolute, dedicated storage directory.");
  return root;
}

export function paparazziFilePath(key: string, root = paparazziStorageDirectory()) {
  const uuid = "[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
  if (!new RegExp(`^private/(?:pending/paparazzi/${uuid}/${uuid}/${uuid}/source|paparazzi/${uuid}/${uuid}/${uuid}\\.jpg)$`).test(key)) throw new Error("Invalid Paparazi storage key.");
  const destination = path.resolve(root, key);
  if (!destination.startsWith(`${path.resolve(root)}${path.sep}`)) throw new Error("Invalid Paparazi storage path.");
  return destination;
}

export async function ensurePaparazziDirectory() {
  const root = paparazziStorageDirectory();
  await mkdir(root, { recursive: true, mode: 0o700 });
  if (await realpath(root) !== path.resolve(root)) throw new Error("Paparazi storage root must not be a symbolic link.");
  await access(root, constants.R_OK | constants.W_OK);
  return root;
}

export async function removePaparazziTemporaryFiles(photoId: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(photoId)) throw new Error("Invalid Paparazi photo ID.");
  await rm(path.join(paparazziStorageDirectory(), ".tmp", photoId), { recursive: true, force: true });
}

export async function stagePaparazziServerFile(key: string, bytes: Buffer, signal?: AbortSignal) {
  const root = await ensurePaparazziDirectory();
  const info = await statfs(root);
  const reserve = Number(process.env.PAPARAZZI_MIN_FREE_BYTES ?? 536_870_912);
  if (!Number.isSafeInteger(reserve) || reserve < 0) throw new Error("Invalid Paparazi free-space setting.");
  if (info.bavail * info.bsize < reserve + bytes.length) throw new PaparazziDiskFullError("Penyimpanan server hampir penuh. Hubungi pemilik acara.");
  const destination = paparazziFilePath(key, root);
  await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
  const photoId = key.endsWith("/source") ? path.basename(path.dirname(destination)) : path.basename(destination, ".jpg");
  const temporaryDirectory = path.join(root, ".tmp", photoId);
  await mkdir(temporaryDirectory, { recursive: true, mode: 0o700 });
  const temp = path.join(temporaryDirectory, `${randomUUID()}.tmp`);
  const size = bytes.length; const hash = createHash("sha256").update(bytes).digest();
  const dispose = () => unlink(temp).catch(error => { if (error.code !== "ENOENT") throw error; });
  try { await writeFile(temp, bytes, { flag: "wx", mode: 0o600, signal, flush: true }); }
  catch (error) { await dispose(); throw error; }
  return {
    dispose,
    async commit(exclusive = false) {
      signal?.throwIfAborted();
      if (!exclusive) { await rename(temp, destination); return; }
      try { await link(temp, destination); }
      catch (error) {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST") throw error;
        const existing = await open(destination, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
          if ((await existing.stat()).size !== size || !createHash("sha256").update(await existing.readFile()).digest().equals(hash)) throw new PaparazziUploadConflictError("Unggahan foto sudah berbeda. Pilih ulang foto.");
        } finally { await existing.close(); }
      }
    },
  };
}

export function paparazziServerStore(signal?: AbortSignal) {
  return {
    async head(key: string) {
      const info = await lstat(paparazziFilePath(key));
      if (!info.isFile() || info.isSymbolicLink()) throw new Error("Invalid Paparazi image file.");
      return { size: info.size };
    },
    async read(key: string): Promise<ReadableStream<Uint8Array>> {
      const file = await open(paparazziFilePath(key), constants.O_RDONLY | constants.O_NOFOLLOW);
      try {
        if (!(await file.stat()).isFile()) throw new Error("Invalid Paparazi image file.");
        return Readable.toWeb(file.createReadStream({ autoClose: true, signal })) as ReadableStream<Uint8Array>;
      } catch (error) { await file.close(); throw error; }
    },
    async write(key: string, bytes: Buffer, _contentType: string, exclusive = false) {
      const staged = await stagePaparazziServerFile(key, bytes, signal);
      try { await staged.commit(exclusive); } finally { await staged.dispose(); }
    },
    async delete(key: string) {
      const destination = paparazziFilePath(key);
      await unlink(destination).catch(error => { if (error.code !== "ENOENT") throw error; });
    },
  };
}
