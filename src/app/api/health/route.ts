import { NextResponse } from "next/server";
import IORedis from "ioredis";
import { getPrismaClient } from "@/lib/prisma";
import { isWorkerHeartbeatActive, WORKER_HEARTBEAT_KEY } from "@/lib/worker-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function checkDatabase() {
  try {
    await getPrismaClient().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkRedis() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return { available: false, worker: false };

  const redis = new IORedis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 2_000,
    commandTimeout: 2_000,
    maxRetriesPerRequest: 0,
    enableOfflineQueue: false,
    retryStrategy: () => null,
  });

  try {
    await redis.connect();
    const available = (await redis.ping()) === "PONG";
    if (!available) return { available: false, worker: false };
    const worker = isWorkerHeartbeatActive(await redis.get(WORKER_HEARTBEAT_KEY));
    return { available, worker };
  } catch {
    return { available: false, worker: false };
  } finally {
    redis.disconnect();
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  const available = database && redis.available && redis.worker;
  return NextResponse.json({
    status: available ? "ok" : "unavailable",
    dependencies: {
      database: database ? "ok" : "unavailable",
      redis: redis.available ? "ok" : "unavailable",
      worker: redis.worker ? "ok" : "unavailable",
    },
  }, {
    status: available ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
