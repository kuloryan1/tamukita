import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
const pageSize = 25;

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  if (!await allowRequest(`admin:workspaces:search:${userId}`, 120, 60 * 60)) return NextResponse.json({ error: "Batas pencarian tercapai. Coba lagi nanti." }, { status: 429 });

  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const requestedPage = Number(params.get("page") ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100_000) : 1;
  const where = {
    type: { not: "PLATFORM" as const },
    ...(query ? {
      OR: [
        { name: { contains: query, mode: "insensitive" as const } },
        { slug: { contains: query, mode: "insensitive" as const } },
        { memberships: { some: { role: "OWNER" as const, user: { name: { contains: query, mode: "insensitive" as const } } } } },
        { memberships: { some: { role: "OWNER" as const, user: { email: { contains: query, mode: "insensitive" as const } } } } },
      ],
    } : {}),
  };
  const [total, organizations] = await Promise.all([
    prisma.organization.count({ where }),
    prisma.organization.findMany({
      where,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        type: true,
        status: true,
        updatedAt: true,
        memberships: {
          where: { role: "OWNER" },
          take: 1,
          select: { user: { select: { name: true, email: true } } },
        },
        _count: { select: { memberships: true, invitations: { where: { deletedAt: null } } } },
      },
    }),
  ]);

  return NextResponse.json({
    page,
    pageSize,
    total,
    workspaces: organizations.map((organization) => ({
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      type: organization.type,
      status: organization.status,
      updatedAt: organization.updatedAt.toISOString(),
      owner: organization.memberships[0]?.user.name ?? "Pemilik belum ditetapkan",
      email: organization.memberships[0]?.user.email ?? "",
      members: organization._count.memberships,
      invitations: organization._count.invitations,
    })),
  }, { headers: { "Cache-Control": "private, no-store" } });
}
