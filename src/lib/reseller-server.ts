import "server-only";

import { getPrismaClient } from "@/lib/prisma";

const managerRoles = ["OWNER", "ADMIN", "RESELLER_STAFF"] as const;

export async function getApprovedReseller(userId: string) {
  return getPrismaClient().resellerProfile.findFirst({
    where: {
      status: "APPROVED",
      organization: {
        type: "RESELLER",
        status: "ACTIVE",
        memberships: { some: { userId, role: { in: [...managerRoles] } } },
      },
    },
    select: { organizationId: true, businessName: true },
  });
}

export async function getApprovedResellerManager(userId: string) {
  return getPrismaClient().resellerProfile.findFirst({
    where: {
      status: "APPROVED",
      organization: {
        type: "RESELLER",
        status: "ACTIVE",
        memberships: { some: { userId, role: { in: ["OWNER", "ADMIN"] } } },
      },
    },
    select: { organizationId: true, businessName: true },
  });
}

export async function hasResellerMembership(userId: string) {
  return getPrismaClient().membership.findFirst({
    where: {
      userId,
      role: { in: [...managerRoles] },
      organization: { type: "RESELLER", status: "ACTIVE" },
    },
    select: { organizationId: true },
  });
}
