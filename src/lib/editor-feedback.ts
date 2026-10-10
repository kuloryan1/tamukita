import "server-only";

import { getPrismaClient } from "@/lib/prisma";

export function canReviewEditorFeedback(role: string | null | undefined) {
  return role === "SUPER_ADMIN" || role === "SUPPORT";
}

export async function getAdminEditorFeedback(view: "active" | "resolved") {
  const prisma = getPrismaClient();
  const historyStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  return prisma.editorFeedback.findMany({
    where: view === "active"
      ? { status: { in: ["OPEN", "IN_REVIEW"] } }
      : { status: "RESOLVED", updatedAt: { gte: historyStart } },
    orderBy: view === "active" ? [{ createdAt: "asc" }, { id: "asc" }] : [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100,
    select: {
      id: true,
      category: true,
      message: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      user: { select: { name: true, email: true } },
      invitation: { select: { title: true, slug: true } },
    },
  });
}
