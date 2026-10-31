import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { paparazziServerStore } from "./paparazzi-server-files";

export type PaparazziProvider = "SERVER" | "R2";

export function paparazziStorageProvider(env: Partial<NodeJS.ProcessEnv> = process.env): PaparazziProvider {
  const value = (env.PAPARAZZI_STORAGE_DRIVER || "server").toLowerCase();
  if (value === "server") return "SERVER";
  if (value === "r2") return "R2";
  throw new Error("PAPARAZZI_STORAGE_DRIVER must be server or r2.");
}

export function paparazziStorage(provider: PaparazziProvider, s3?: S3Client | null, bucket?: string, signal?: AbortSignal) {
  if (provider === "SERVER") return paparazziServerStore(signal);
  if (provider !== "R2" || !s3 || !bucket) throw new Error("Penyimpanan R2 foto belum tersedia.");
  const options = { abortSignal: signal };
  return {
    async head(key: string) { const result = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }), options); return { size: result.ContentLength, contentType: result.ContentType }; },
    async read(key: string): Promise<ReadableStream<Uint8Array>> { const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }), options); if (!result.Body) throw new Error("Empty photo"); return result.Body.transformToWebStream(); },
    async write(key: string, bytes: Buffer, contentType: string) { await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: contentType, ContentLength: bytes.length, CacheControl: "private, no-store" }), options); },
    async delete(key: string) { await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }), options); },
  };
}
