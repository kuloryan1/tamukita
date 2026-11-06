import "server-only";

import type { MediaStorageProvider } from "@/generated/prisma/client";
import { r2KeyFromPublicUrl, r2PublicUrl } from "@/lib/r2";
import { mediaServerFilePath } from "@/lib/media-server-storage";

export function mediaPublicUrl(provider: MediaStorageProvider, key: string) {
  if (provider === "R2") return r2PublicUrl(key);
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL belum dikonfigurasi.");
  const url = new URL(`/api/media/files/${key.split("/").map(encodeURIComponent).join("/")}`, base);
  return url.toString();
}

export function mediaKeyFromPublicUrl(value: string) {
  const r2Key = r2KeyFromPublicUrl(value);
  if (r2Key) return r2Key;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;
  try {
    const base = new URL(appUrl);
    const url = new URL(value);
    const prefix = "/api/media/files/";
    const isSecureOrigin = base.protocol === "https:";
    const isLocalLoopbackOrigin = base.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(base.hostname);
    if ((!isSecureOrigin && !isLocalLoopbackOrigin)
      || url.origin !== base.origin || !url.pathname.startsWith(prefix) || url.search || url.hash || url.username || url.password) return null;
    const segments = url.pathname.slice(prefix.length).split("/");
    const decoded = segments.map((segment) => decodeURIComponent(segment));
    if (!decoded.length || decoded.some((segment) => !segment || segment === "." || segment === ".." || segment.includes("/") || segment.includes("\\"))) return null;
    const key = decoded.join("/");
    mediaServerFilePath(key);
    return key;
  } catch {
    return null;
  }
}

export function isMediaPublicUrl(value: string) {
  return mediaKeyFromPublicUrl(value) !== null;
}
