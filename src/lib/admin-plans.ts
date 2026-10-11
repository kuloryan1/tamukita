import "server-only";

import { getPrismaClient } from "@/lib/prisma";

const pageSize = 25;

export function mapAdminPlan(plan: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  priceIdr: number;
  durationDays: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  entitlements: Array<{ featureKey: string; value: unknown }>;
  _count: { grants: number };
}) {
  return {
    id: plan.id,
    key: plan.key,
    name: plan.name,
    description: plan.description,
    priceIdr: plan.priceIdr,
    durationDays: plan.durationDays,
    isActive: plan.isActive,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    grantCount: plan._count.grants,
    entitlements: plan.entitlements.map((entitlement) => ({ featureKey: entitlement.featureKey, value: entitlement.value })),
  };
}

export async function getAdminPlanDirectory(query: string, page: number) {
  const prisma = getPrismaClient();
  const where = query
    ? {
        OR: [
          { key: { contains: query, mode: "insensitive" as const } },
          { name: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [total, plans] = await Promise.all([
    prisma.plan.count({ where }),
    prisma.plan.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { name: "asc" }, { key: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        entitlements: { orderBy: { featureKey: "asc" } },
        _count: { select: { grants: true } },
      },
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    plans: plans.map(mapAdminPlan),
  };
}
