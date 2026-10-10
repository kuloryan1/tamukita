import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function createRawAccountToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAccountToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isAccountTokenFormatValid(token: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}
