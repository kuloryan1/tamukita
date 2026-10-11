import "server-only";

import { getPrismaClient } from "@/lib/prisma";

export async function getCustomerPlanCatalog() {
  const plans = await getPrismaClient().plan.findMany({
    where: { isActive: true },
    orderBy: [{ priceIdr: "asc" }, { name: "asc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      description: true,
      priceIdr: true,
      durationDays: true,
      updatedAt: true,
      entitlements: { orderBy: { featureKey: "asc" }, select: { featureKey: true, value: true } },
    },
  });
  return plans.map((plan) => ({ ...plan, updatedAt: plan.updatedAt.toISOString() }));
}
