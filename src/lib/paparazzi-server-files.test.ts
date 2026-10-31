import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, realpath, rm, stat, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { ensurePaparazziDirectory, paparazziFilePath, paparazziServerStore, PaparazziDiskFullError, stagePaparazziServerFile } from "./paparazzi-server-files";
import { paparazziStorage, paparazziStorageProvider } from "./paparazzi-storage";

let root: string;
const prefix = `${randomUUID()}/${randomUUID()}/${randomUUID()}`;
const source = `private/pending/paparazzi/${prefix}/source`;
const output = `private/paparazzi/${prefix}.jpg`;
beforeEach(async () => {
  root = await realpath(await mkdtemp(path.join(os.tmpdir(), "tamukita-paparazzi-storage-")));
  vi.stubEnv("PAPARAZZI_STORAGE_DIR", root); vi.stubEnv("PAPARAZZI_MIN_FREE_BYTES", "0");
});
afterEach(async () => { vi.unstubAllEnvs(); await rm(root, { recursive: true, force: true }); });

test("server storage needs no R2 configuration and survives reopening the store", async () => {
  expect(paparazziStorageProvider({})).toBe("SERVER"); expect(paparazziStorageProvider({ PAPARAZZI_STORAGE_DRIVER: "r2" })).toBe("R2");
  expect(() => paparazziStorageProvider({ PAPARAZZI_STORAGE_DRIVER: "unknown" })).toThrow();
  expect(() => paparazziStorage("R2", null)).toThrow("R2");
  const bytes = Buffer.from("synthetic photo bytes");
  await paparazziStorage("SERVER", null).write(source, bytes, "image/jpeg");
  expect((await paparazziStorage("SERVER", null).head(source)).size).toBe(bytes.length);
  expect(Buffer.from(await new Response(await paparazziStorage("SERVER", null).read(source)).arrayBuffer())).toEqual(bytes);
  expect((await stat(paparazziFilePath(source))).mode & 0o777).toBe(0o600);
  await paparazziStorage("SERVER", null).delete(source); await paparazziStorage("SERVER", null).delete(source);
  await expect(readFile(paparazziFilePath(source))).rejects.toMatchObject({ code: "ENOENT" });
});

test("source retries are idempotent and cannot replace different bytes", async () => {
  const storage = paparazziServerStore(); const bytes = Buffer.from("first upload");
  await Promise.all([storage.write(source, bytes, "image/jpeg", true), storage.write(source, bytes, "image/jpeg", true)]);
  await expect(storage.write(source, Buffer.from("other upload"), "image/jpeg", true)).rejects.toThrow("berbeda");
  expect(await readFile(paparazziFilePath(source))).toEqual(bytes);
  expect(await readdir(path.dirname(paparazziFilePath(source)))).toEqual(["source"]);
});

test("processed output is replaced atomically and aborted writes leave no partial output", async () => {
  await paparazziServerStore().write(output, Buffer.from("first"), "image/jpeg");
  await paparazziServerStore().write(output, Buffer.from("second"), "image/jpeg");
  await expect(paparazziServerStore(AbortSignal.abort()).write(output, Buffer.from("partial"), "image/jpeg")).rejects.toThrow();
  expect(await readFile(paparazziFilePath(output), "utf8")).toBe("second");
  expect(await readdir(path.dirname(paparazziFilePath(output)))).toEqual([`${prefix.split("/").at(-1)}.jpg`]);
});

test("untrusted keys, file symlinks, and symlinked roots cannot expose another file", async () => {
  for (const key of ["../../etc/passwd", `${source}/../source`, "/etc/passwd", "private/paparazzi/arbitrary.jpg"]) expect(() => paparazziFilePath(key)).toThrow();
  const destination = paparazziFilePath(source); await mkdir(path.dirname(destination), { recursive: true });
  await symlink(path.join(root, "outside"), destination);
  await expect(paparazziServerStore().head(source)).rejects.toThrow();
  await expect(paparazziServerStore().read(source)).rejects.toThrow();
  const alias = path.join(root, "alias"); await symlink(root, alias); vi.stubEnv("PAPARAZZI_STORAGE_DIR", alias);
  await expect(ensurePaparazziDirectory()).rejects.toThrow("symbolic link");
});

test("the disk reserve rejects new files before using the server's remaining capacity", async () => {
  vi.stubEnv("PAPARAZZI_MIN_FREE_BYTES", String(Number.MAX_SAFE_INTEGER));
  await expect(paparazziServerStore().write(source, Buffer.from("photo"), "image/jpeg")).rejects.toBeInstanceOf(PaparazziDiskFullError);
  await expect(readFile(paparazziFilePath(source))).rejects.toMatchObject({ code: "ENOENT" });
});

test("an abandoned or cancelled staged upload cannot become a readable source", async () => {
  const staged = await stagePaparazziServerFile(source, Buffer.from("unpublished upload"));
  await expect(paparazziServerStore().head(source)).rejects.toMatchObject({ code: "ENOENT" });
  await staged.dispose();
  const controller = new AbortController();
  const cancelled = await stagePaparazziServerFile(source, Buffer.from("cancelled upload"), controller.signal);
  controller.abort();
  await expect(cancelled.commit(true)).rejects.toThrow(); await cancelled.dispose();
  await expect(paparazziServerStore().head(source)).rejects.toMatchObject({ code: "ENOENT" });
  expect(await readdir(path.join(root, ".tmp", prefix.split("/").at(-1) ?? ""))).toEqual([]);
});
