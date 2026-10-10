import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const statusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Workspace tidak valid." }, { status: 400 });
  if (!await allowRequest(`admin:workspace-status:${userId}`, 60, 60 * 60)) return NextResponse.json({ error: "Batas perubahan status tercapai. Coba lagi nanti." }, { status: 429 });

  const body = await readJsonBody(request, 2_000);
  if (!body.ok) return NextResponse.json({ error: "Perubahan status tidak valid." }, { status: body.status });
  const parsed = statusSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih status workspace yang valid." }, { status: 400 });

  const workspace = await prisma.organization.findFirst({
    where: { id, type: { not: "PLATFORM" } },
    select: { id: true, status: true },
  });
  if (!workspace) return NextResponse.json({ error: "Workspace tidak ditemukan." }, { status: 404 });
  if (workspace.status === parsed.data.status) return NextResponse.json({ status: workspace.status });

  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.organization.updateMany({
      where: { id, status: workspace.status, type: { not: "PLATFORM" } },
      data: { status: parsed.data.status },
    });
    if (result.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        organizationId: id,
        actorId: userId,
        action: "admin.workspace_status_changed",
        targetType: "Organization",
        targetId: id,
        metadata: { previousStatus: workspace.status, nextStatus: parsed.data.status },
      },
    });
    return true;
  });
  if (!changed) return NextResponse.json({ error: "Status workspace berubah. Muat ulang lalu coba lagi." }, { status: 409 });
  return NextResponse.json({ status: parsed.data.status });
}
