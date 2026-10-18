import Redis from "ioredis";
import { isWorkerHeartbeatActive, WORKER_HEARTBEAT_KEY } from "../src/lib/worker-health";

async function main() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    process.exitCode = 1;
    return;
  }

  const redis = new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: 2_500,
    maxRetriesPerRequest: 1,
  });

  try {
    await redis.connect();
    if (!isWorkerHeartbeatActive(await redis.get(WORKER_HEARTBEAT_KEY))) {
      process.exitCode = 1;
    }
  } catch {
    process.exitCode = 1;
  } finally {
    redis.disconnect();
  }
}

void main().catch(() => {
  process.exitCode = 1;
});
