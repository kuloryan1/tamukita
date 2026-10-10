import { createHmac } from "node:crypto";

export function createReporterFingerprint(entryId: string, address: string, secret = process.env.AUTH_SECRET) {
  if (!secret) throw new Error("AUTH_SECRET diperlukan untuk deduplikasi laporan konten.");
  return createHmac("sha256", secret)
    .update(`guestbook-report:${entryId}:${address}`)
    .digest("hex");
}
