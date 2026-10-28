import { createHmac } from "node:crypto";

function createFingerprint(kind: "guestbook" | "invitation", targetId: string, address: string, secret = process.env.AUTH_SECRET) {
  if (!secret) throw new Error("AUTH_SECRET diperlukan untuk deduplikasi laporan konten.");
  return createHmac("sha256", secret)
    .update(`${kind}-report:${targetId}:${address}`)
    .digest("hex");
}

export function createReporterFingerprint(entryId: string, address: string, secret = process.env.AUTH_SECRET) {
  return createFingerprint("guestbook", entryId, address, secret);
}

export function createInvitationReporterFingerprint(invitationId: string, address: string, secret = process.env.AUTH_SECRET) {
  return createFingerprint("invitation", invitationId, address, secret);
}
