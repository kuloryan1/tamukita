import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const roleSchema = z.object({ role: z.enum(["ADMIN", "EDITOR", "VIEWER", "RESELLER_STAFF"]) });
const uuidSchema = z.string().uuid();

async function getAuthorizedAdmin() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }) };
  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") return { error: NextResponse.json({ error: "Akses ditolak." }, { status: 403 }) };
  return { userId, prisma };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; membershipId: string }> }) {
  const authResult = await getAuthorizedAdmin();
  if ("error" in authResult) return authResult.error;
  const { userId, prisma } = authResult;
  const { id, membershipId } = await params;
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(membershipId).success) return NextResponse.json({ error: "Anggota workspace tidak valid." }, { status: 400 });
  if (!await allowRequest(`admin:workspace-members:${userId}`, 120, 60 * 60)) return NextResponse.json({ error: "Batas perubahan anggota tercapai. Coba lagi nanti." }, { status: 429 });

  const body = await readJsonBody(request, 2_000);
  if (!body.ok) return NextResponse.json({ error: "Perubahan peran tidak valid." }, { status: body.status });
  const parsed = roleSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih peran anggota yang valid." }, { status: 400 });

  const [workspace, membership] = await Promise.all([
    prisma.organization.findFirst({ where: { id, type: { not: "PLATFORM" } }, select: { id: true, type: true } }),
    prisma.membership.findFirst({ where: { id: membershipId, organizationId: id }, select: { id: true, userId: true, role: true } }),
  ]);
  if (!workspace || !membership) return NextResponse.json({ error: "Workspace atau anggota tidak ditemukan." }, { status: 404 });
  if (membership.role === "OWNER") return NextResponse.json({ error: "Peran pemilik dilindungi. Gunakan proses transfer kepemilikan." }, { status: 409 });
  if (parsed.data.role === "RESELLER_STAFF" && workspace.type !== "RESELLER") return NextResponse.json({ error: "Peran staf reseller hanya berlaku untuk workspace reseller." }, { status: 400 });
  if (membership.role === parsed.data.role) return NextResponse.json({ role: membership.role });

  const changed = await prisma.$transaction(async (tx) => {
    const result = await tx.membership.updateMany({
      where: { id: membership.id, organizationId: id, role: membership.role },
      data: { role: parsed.data.role },
    });
    if (result.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        organizationId: id,
        actorId: userId,
        action: "admin.workspace_member_role_changed",
        targetType: "Membership",
        targetId: membership.id,
        metadata: { userId: membership.userId, previousRole: membership.role, nextRole: parsed.data.role },
      },
    });
    return true;
  });
  if (!changed) return NextResponse.json({ error: "Peran anggota berubah. Muat ulang lalu coba lagi." }, { status: 409 });
  return NextResponse.json({ role: parsed.data.role });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; membershipId: string }> }) {
  const authResult = await getAuthorizedAdmin();
  if ("error" in authResult) return authResult.error;
  const { userId, prisma } = authResult;
  const { id, membershipId } = await params;
  if (!uuidSchema.safeParse(id).success || !uuidSchema.safeParse(membershipId).success) return NextResponse.json({ error: "Anggota workspace tidak valid." }, { status: 400 });
  if (!await allowRequest(`admin:workspace-members:${userId}`, 120, 60 * 60)) return NextResponse.json({ error: "Batas perubahan anggota tercapai. Coba lagi nanti." }, { status: 429 });

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, organizationId: id, organization: { type: { not: "PLATFORM" } } },
    select: { id: true, userId: true, role: true },
  });
  if (!membership) return NextResponse.json({ error: "Anggota tidak ditemukan." }, { status: 404 });
  if (membership.role === "OWNER") return NextResponse.json({ error: "Pemilik tidak dapat dihapus dari workspace." }, { status: 409 });

  const removed = await prisma.$transaction(async (tx) => {
    const result = await tx.membership.deleteMany({ where: { id: membership.id, organizationId: id, role: { not: "OWNER" } } });
    if (result.count !== 1) return false;
    await tx.auditLog.create({
      data: {
        organizationId: id,
        actorId: userId,
        action: "admin.workspace_member_removed",
        targetType: "Membership",
        targetId: membership.id,
        metadata: { userId: membership.userId, previousRole: membership.role },
      },
    });
    return true;
  });
  if (!removed) return NextResponse.json({ error: "Anggota berubah. Muat ulang lalu coba lagi." }, { status: 409 });
  return NextResponse.json({ removed: true });
}
