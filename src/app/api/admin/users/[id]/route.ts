import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { PLATFORM_ROLE_VALUES } from "@/lib/platform-roles";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const uuidSchema = z.string().uuid();
const roleSchema = z.object({ platformRole: z.enum(PLATFORM_ROLE_VALUES) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const actorId = session?.user?.id;
  if (!actorId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

  const prisma = getPrismaClient();
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { platformRole: true } });
  if (actor?.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Akun pengguna tidak valid." }, { status: 400 });
  if (!await allowRequest(`admin:user-role:${actorId}`, 60, 60 * 60)) return NextResponse.json({ error: "Batas perubahan peran tercapai. Coba lagi nanti." }, { status: 429 });

  const body = await readJsonBody(request, 2_000);
  if (!body.ok) return NextResponse.json({ error: "Perubahan peran tidak valid." }, { status: body.status });
  const parsed = roleSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih peran platform yang tersedia." }, { status: 400 });

  const outcome = await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id }, select: { platformRole: true } });
    if (!current) return { kind: "not-found" as const };
    if (current.platformRole === parsed.data.platformRole) return { kind: "unchanged" as const };
    if (actorId === id) return { kind: "self-change" as const };

    if (current.platformRole === "SUPER_ADMIN" && parsed.data.platformRole !== "SUPER_ADMIN") {
      const superAdmins = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "users" WHERE "platformRole" = 'SUPER_ADMIN'::"PlatformRole" FOR UPDATE
      `;
      if (!superAdmins.some((user) => user.id === id)) return { kind: "conflict" as const };
      if (superAdmins.length <= 1) return { kind: "last-super-admin" as const };
    }

    const updated = await tx.user.updateMany({
      where: { id, platformRole: current.platformRole },
      data: { platformRole: parsed.data.platformRole },
    });
    if (updated.count !== 1) return { kind: "conflict" as const };

    await tx.auditLog.create({
      data: {
        actorId,
        action: "admin.user_platform_role_changed",
        targetType: "User",
        targetId: id,
        metadata: { previousRole: current.platformRole, nextRole: parsed.data.platformRole },
      },
    });
    return { kind: "updated" as const };
  });

  if (outcome.kind === "not-found") return NextResponse.json({ error: "Akun pengguna tidak ditemukan." }, { status: 404 });
  if (outcome.kind === "self-change") return NextResponse.json({ error: "Peran akun Super Admin yang sedang digunakan tidak dapat diubah." }, { status: 409 });
  if (outcome.kind === "last-super-admin") return NextResponse.json({ error: "Pertahankan setidaknya satu akun Super Admin." }, { status: 409 });
  if (outcome.kind === "conflict") return NextResponse.json({ error: "Peran akun berubah. Muat ulang direktori lalu coba lagi." }, { status: 409 });
  return NextResponse.json({ platformRole: parsed.data.platformRole, unchanged: outcome.kind === "unchanged" });
}
