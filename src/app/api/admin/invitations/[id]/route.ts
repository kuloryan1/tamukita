import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const moderationSchema = z.object({ status: z.enum(["PUBLISHED", "SUSPENDED"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID undangan tidak valid." }, { status: 400 });
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Pilihan moderasi tidak valid." }, { status: body.status });
  const parsed = moderationSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Status moderasi tidak valid." }, { status: 400 });

  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  const invitation = await prisma.invitation.findFirst({ where: { id, deletedAt: null }, select: { id: true, organizationId: true, status: true, publishedSnapshot: true } });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });
  if (parsed.data.status === "PUBLISHED" && (invitation.status !== "SUSPENDED" || !invitation.publishedSnapshot)) {
    return NextResponse.json({ error: "Hanya undangan yang pernah terbit dan sedang ditangguhkan yang dapat dipulihkan." }, { status: 409 });
  }
  if (parsed.data.status === "SUSPENDED" && invitation.status !== "PUBLISHED") {
    return NextResponse.json({ error: "Hanya undangan aktif yang dapat ditangguhkan." }, { status: 409 });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.invitation.updateMany({ where: { id, status: invitation.status, deletedAt: null }, data: { status: parsed.data.status } });
    if (result.count !== 1) return false;
    await tx.auditLog.create({
      data: { organizationId: invitation.organizationId, actorId: userId, action: parsed.data.status === "SUSPENDED" ? "invitation.suspended_by_admin" : "invitation.restored_by_admin", targetType: "Invitation", targetId: id, metadata: { previousStatus: invitation.status } },
    });
    return true;
  });
  if (!updated) return NextResponse.json({ error: "Status undangan sudah berubah. Muat ulang halaman." }, { status: 409 });
  return NextResponse.json({ updated: true, status: parsed.data.status });
}
