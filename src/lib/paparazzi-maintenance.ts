import type { S3Client } from "@aws-sdk/client-s3";
import type { PrismaClient } from "../generated/prisma/client";
import { sweepPaparazziPhotos } from "./paparazzi-processing";

export function startPaparazziMaintenance(prisma: PrismaClient, s3: S3Client | null, bucket?: string) {
  let running = false;
  async function run() {
    if (running || !s3 || !bucket) return;
    running = true;
    try { await sweepPaparazziPhotos(prisma, s3, bucket); }
    catch { process.stderr.write("[background-worker] Paparazi storage cleanup will be retried.\n"); }
    finally { running = false; }
  }
  void run();
  const timer = setInterval(() => void run(), 15 * 60 * 1_000);
  return () => clearInterval(timer);
}
