import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const DEMO_LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
const invitationIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type InvitationDemoPayload = {
  invitationId: string;
  updatedAt: string;
  expiresAt: number;
};

function signature(encodedPayload: string, secret: string) {
  return createHmac("sha256", secret).update(`tamukita-invitation-demo:v1:${encodedPayload}`).digest("base64url");
}

export function createInvitationDemoToken(invitationId: string, updatedAt: Date, now = Date.now()) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET diperlukan untuk tautan demo.");
  if (!invitationIdPattern.test(invitationId) || Number.isNaN(updatedAt.getTime())) throw new Error("Draft demo tidak valid.");

  const payload: InvitationDemoPayload = {
    invitationId,
    updatedAt: updatedAt.toISOString(),
    expiresAt: now + DEMO_LINK_LIFETIME_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signature(encodedPayload, secret)}`;
}

export function verifyInvitationDemoToken(token: string, now = Date.now()): InvitationDemoPayload | null {
  const secret = process.env.AUTH_SECRET;
  if (!secret || token.length > 512 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return null;

  const [encodedPayload, providedSignature] = token.split(".");
  const expected = Buffer.from(signature(encodedPayload, secret), "base64url");
  const actual = Buffer.from(providedSignature, "base64url");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as Partial<InvitationDemoPayload>;
    const updatedAt = typeof payload.updatedAt === "string" ? new Date(payload.updatedAt) : null;
    if (
      typeof payload.invitationId !== "string"
      || !invitationIdPattern.test(payload.invitationId)
      || !updatedAt
      || Number.isNaN(updatedAt.getTime())
      || updatedAt.toISOString() !== payload.updatedAt
      || typeof payload.expiresAt !== "number"
      || !Number.isSafeInteger(payload.expiresAt)
      || payload.expiresAt <= now
    ) return null;
    return { invitationId: payload.invitationId, updatedAt: payload.updatedAt, expiresAt: payload.expiresAt };
  } catch {
    return null;
  }
}

export const invitationDemoLifetimeDays = DEMO_LINK_LIFETIME_MS / (24 * 60 * 60 * 1000);
