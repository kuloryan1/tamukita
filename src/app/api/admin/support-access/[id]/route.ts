import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID akses bantuan tidak valid." }, { status: 400 });
  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  if (!await allowRequest(`admin:support-access:revoke:${userId}`, 30, 60 * 60)) return NextResponse.json({ error: "Batas pencabutan akses bantuan tercapai. Coba lagi nanti." }, { status: 429 });

  const grant = await prisma.supportAccessGrant.findFirst({ where: { id, adminId: userId }, select: { id: true, organizationId: true, invitationId: true, reason: true } });
  if (!grant) return NextResponse.json({ error: "Akses bantuan tidak ditemukan." }, { status: 404 });
  const revokedAt = new Date();
  const revoked = await prisma.$transaction(async (tx) => {
    const result = await tx.supportAccessGrant.updateMany({ where: { id, adminId: userId, revokedAt: null }, data: { revokedAt } });
    if (result.count !== 1) return false;
    await tx.auditLog.create({ data: { organizationId: grant.organizationId, actorId: userId, action: "admin.support_access_revoked", targetType: "SupportAccessGrant", targetId: id, metadata: { invitationId: grant.invitationId, reason: grant.reason } } });
    return true;
  });
  if (!revoked) return NextResponse.json({ error: "Akses bantuan sudah dicabut." }, { status: 409 });
  return NextResponse.json({ revoked: true, revokedAt: revokedAt.toISOString() });
}
