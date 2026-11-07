import { createHmac } from "node:crypto";
import type { Pool } from "pg";

export async function resetE2eLoginRateLimit(pool: Pool, email: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET diperlukan untuk mereset limiter fixture E2E.");
  const key = createHmac("sha256", secret).update(`login:${email}`).digest("hex");
  await pool.query('DELETE FROM rate_limit_buckets WHERE key = $1', [key]);
}
