import "server-only";

import { S3Client } from "@aws-sdk/client-s3";
import { containsControlCharacters } from "@/lib/text";

const globalForR2 = globalThis as typeof globalThis & { tamukitaR2?: S3Client };

function isLoopback(hostname: string) {
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

export function getR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const privateBucket = process.env.R2_PRIVATE_BUCKET_NAME || process.env.R2_BUCKET_NAME;
  const publicBucket = process.env.R2_PUBLIC_BUCKET_NAME;
  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL;
  if (!accountId || !accessKeyId || !secretAccessKey || !privateBucket || !publicBucket || !publicBaseUrl) return null;
  const localMockEnabled = process.env.E2E_R2_MOCK === "true";
  const s3Endpoint = process.env.R2_S3_ENDPOINT || `https://${accountId}.r2.cloudflarestorage.com`;
  try {
    const publicUrl = new URL(publicBaseUrl);
    const endpointUrl = new URL(s3Endpoint);
    const publicIsSecure = publicUrl.protocol === "https:";
    const endpointIsSecure = endpointUrl.protocol === "https:";
    const publicUsesLocalMock = localMockEnabled && publicUrl.protocol === "http:" && isLoopback(publicUrl.hostname);
    const endpointUsesLocalMock = localMockEnabled && endpointUrl.protocol === "http:" && isLoopback(endpointUrl.hostname);
    if ((!publicIsSecure && !publicUsesLocalMock) || (!endpointIsSecure && !endpointUsesLocalMock)) return null;
    if (localMockEnabled && (!publicUsesLocalMock || !endpointUsesLocalMock)) return null;
  } catch {
    return null;
  }
  return { accountId, accessKeyId, secretAccessKey, privateBucket, publicBucket, publicBaseUrl, s3Endpoint, forcePathStyle: Boolean(process.env.R2_S3_ENDPOINT) };
}

export function getR2Client() {
  const config = getR2Config();
  if (!config) throw new Error("Cloudflare R2 belum dikonfigurasi.");
  if (globalForR2.tamukitaR2) return globalForR2.tamukitaR2;
  const client = new S3Client({
    region: "auto",
    endpoint: config.s3Endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  });
  if (process.env.NODE_ENV !== "production") globalForR2.tamukitaR2 = client;
  return client;
}

export function r2PublicUrl(key: string) {
  const config = getR2Config();
  if (!config) throw new Error("Cloudflare R2 belum dikonfigurasi.");
  const base = config.publicBaseUrl.endsWith("/") ? config.publicBaseUrl : `${config.publicBaseUrl}/`;
  return new URL(key.split("/").map(encodeURIComponent).join("/"), base).toString();
}

export function r2KeyFromPublicUrl(value: string) {
  const config = getR2Config();
  if (!config) return null;
  try {
    const base = new URL(config.publicBaseUrl);
    const url = new URL(value);
    const basePath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
    const localMockUrl = process.env.E2E_R2_MOCK === "true"
      && base.protocol === "http:"
      && url.protocol === "http:"
      && isLoopback(base.hostname)
      && isLoopback(url.hostname);
    if (!localMockUrl && (base.protocol !== "https:" || url.protocol !== "https:")) return null;
    if (url.origin !== base.origin
      || !url.pathname.startsWith(basePath)
      || url.search
      || url.hash
      || url.username
      || url.password) return null;
    const segments = url.pathname.slice(basePath.length).split("/");
    if (!segments.length || segments.some((segment) => !segment)) return null;
    const decoded: string[] = [];
    for (const segment of segments) {
      const value = decodeURIComponent(segment);
      if (!value || value === "." || value === ".." || value.includes("/") || value.includes("\\") || containsControlCharacters(value)) return null;
      decoded.push(value);
    }
    return decoded.join("/");
  } catch {
    return null;
  }
}

export function isR2PublicUrl(value: string) {
  return r2KeyFromPublicUrl(value) !== null;
}
