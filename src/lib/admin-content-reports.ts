import "server-only";

import { getPrismaClient } from "@/lib/prisma";

export function canReviewContentReports(role: string | null | undefined) {
  return role === "SUPER_ADMIN" || role === "CONTENT_REVIEWER";
}

export async function getAdminContentReports(view: "pending" | "history") {
  const prisma = getPrismaClient();
  const historyStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return prisma.contentReport.findMany({
    where: view === "pending"
      ? { status: "PENDING" }
      : { status: { in: ["DISMISSED", "HIDDEN", "RESTORED"] }, reviewedAt: { gte: historyStart } },
    orderBy: view === "pending" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ reviewedAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      guestbookEntry: {
        select: {
          id: true,
          displayName: true,
          message: true,
          status: true,
          createdAt: true,
          invitation: { select: { id: true, title: true, slug: true } },
        },
      },
    },
  });
}

export async function getAdminInvitationReports(view: "pending" | "history") {
  const prisma = getPrismaClient();
  const historyStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return prisma.invitationReport.findMany({
    where: view === "pending"
      ? { status: "PENDING" }
      : { status: { in: ["DISMISSED", "HIDDEN", "RESTORED"] }, reviewedAt: { gte: historyStart } },
    orderBy: view === "pending" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ reviewedAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      reason: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      invitation: {
        select: { id: true, title: true, slug: true, status: true, expiresAt: true, paparazziAlbum: { select: { token: true } } },
      },
    },
  });
}
