import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { resolveInvitationFeatureAccess } from "@/lib/invitation-features";

export async function getInvitationFeatureAccess(invitationId: string, now = new Date()) {
  const prisma = getPrismaClient();
  const planHosting = await prisma.entitlement.findFirst({
    where: { invitationId, featureKey: "hosting", planId: { not: null } },
    orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
    select: { planId: true, status: true, startsAt: true, expiresAt: true },
  });

  if (!planHosting) return resolveInvitationFeatureAccess(null);
  if (planHosting.status !== "ACTIVE" || planHosting.expiresAt && planHosting.expiresAt <= now) {
    return resolveInvitationFeatureAccess([]);
  }

  const grants = await prisma.entitlement.findMany({
    where: {
      invitationId,
      planId: planHosting.planId,
      status: "ACTIVE",
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      featureKey: { not: "hosting" },
    },
    select: { featureKey: true, value: true },
  });

  return resolveInvitationFeatureAccess(grants);
}
