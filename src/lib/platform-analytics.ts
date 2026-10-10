import "server-only";

import { getPrismaClient } from "@/lib/prisma";

export type PlatformViewMetric = "template_catalog_views" | "template_detail_views";

export async function recordPlatformView(metricKey: PlatformViewMetric) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  try {
    await getPrismaClient().platformAnalyticsDaily.upsert({
      where: { date_metricKey: { date, metricKey } },
      create: { date, metricKey, metricValue: BigInt(1) },
      update: { metricValue: { increment: BigInt(1) } },
    });
  } catch {
    console.error(`Failed to record platform view metric: ${metricKey}.`);
  }
}
