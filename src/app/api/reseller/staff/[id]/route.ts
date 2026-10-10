import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { getApprovedReseller } from "@/lib/reseller-server";

export const runtime = "nodejs";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Anggota tidak valid." }, { status: 400 });
  const reseller = await getApprovedReseller(userId);
  if (!reseller) return NextResponse.json({ error: "Akun reseller belum disetujui." }, { status: 403 });
  const prisma = getPrismaClient();
  const ownerMembership = await prisma.membership.findFirst({ where: { organizationId: reseller.organizationId, userId, role: "OWNER" }, select: { id: true } });
  if (!ownerMembership) return NextResponse.json({ error: "Hanya pemilik workspace reseller yang dapat mengelola staf." }, { status: 403 });
  const staff = await prisma.membership.findFirst({ where: { id, organizationId: reseller.organizationId, role: "RESELLER_STAFF" }, select: { userId: true } });
  if (!staff) return NextResponse.json({ error: "Staf tidak ditemukan." }, { status: 404 });
  await prisma.$transaction(async (tx) => {
    await tx.membership.delete({ where: { id } });
    await tx.auditLog.create({ data: { organizationId: reseller.organizationId, actorId: userId, action: "reseller.staff_removed", targetType: "User", targetId: staff.userId } });
  });
  return NextResponse.json({ removed: true });
}
