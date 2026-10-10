import "server-only";

import { createHmac } from "node:crypto";
import { getPrismaClient } from "@/lib/prisma";

export function getRequestAddress(request: Request) {
  return request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

export async function allowRequest(key: string, limit: number, windowSeconds: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET diperlukan untuk rate limit.");
  const digest = createHmac("sha256", secret).update(key).digest("hex");
  const bucketKey = digest.slice(0, 64);
  const now = new Date();
  const threshold = new Date(now.getTime() - windowSeconds * 1000);
  const prisma = getPrismaClient();
  const rows = await prisma.$queryRaw<Array<{ hits: number }>>`
    INSERT INTO "rate_limit_buckets" ("key", "hits", "windowStartedAt")
    VALUES (${bucketKey}, 1, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "hits" = CASE WHEN "rate_limit_buckets"."windowStartedAt" <= ${threshold}
        THEN 1 ELSE "rate_limit_buckets"."hits" + 1 END,
      "windowStartedAt" = CASE WHEN "rate_limit_buckets"."windowStartedAt" <= ${threshold}
        THEN ${now} ELSE "rate_limit_buckets"."windowStartedAt" END
    RETURNING "hits"
  `;
  if (rows[0]?.hits === 1 && Math.random() < 0.01) {
    void prisma.rateLimitBucket.deleteMany({ where: { windowStartedAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } } }).catch(() => undefined);
  }
  return (rows[0]?.hits ?? limit + 1) <= limit;
}
