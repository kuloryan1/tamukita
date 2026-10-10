import "server-only";

import { getPrismaClient } from "@/lib/prisma";

export type PlatformMetricKey = "template_catalog_views" | "template_detail_views" | "template_catalog_unique_visitors";

export async function recordPlatformMetric(metricKey: PlatformMetricKey) {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  try {
    await getPrismaClient().platformAnalyticsDaily.upsert({
      where: { date_metricKey: { date, metricKey } },
      create: { date, metricKey, metricValue: BigInt(1) },
      update: { metricValue: { increment: BigInt(1) } },
    });
    return true;
  } catch {
    console.error(`Failed to record platform analytics metric: ${metricKey}.`);
    return false;
  }
}
