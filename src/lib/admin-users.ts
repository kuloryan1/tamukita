import "server-only";

import { getPrismaClient } from "@/lib/prisma";

const pageSize = 25;

export async function getAdminUserDirectory(query: string, page: number) {
  const prisma = getPrismaClient();
  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        email: true,
        platformRole: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
    }),
  ]);

  return {
    page,
    pageSize,
    total,
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      platformRole: user.platformRole,
      createdAt: user.createdAt.toISOString(),
      workspaceCount: user._count.memberships,
    })),
  };
}
