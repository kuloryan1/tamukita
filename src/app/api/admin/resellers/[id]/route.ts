import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const reviewSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID pengajuan tidak valid." }, { status: 400 });
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Pilihan moderasi tidak valid." }, { status: body.status });
  const parsed = reviewSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih setujui atau tolak." }, { status: 400 });

  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Akses admin diperlukan." }, { status: 403 });
  const profile = await prisma.resellerProfile.findUnique({ where: { id }, select: { id: true, organizationId: true } });
  if (!profile) return NextResponse.json({ error: "Pengajuan reseller tidak ditemukan." }, { status: 404 });
  const reviewedAt = new Date();
  const changed = await prisma.$transaction(async (tx) => {
    const updated = await tx.resellerProfile.updateMany({
      where: { id, status: "PENDING" },
      data: { status: parsed.data.status, approvedAt: parsed.data.status === "APPROVED" ? reviewedAt : null },
    });
    if (!updated.count) return false;
    await tx.auditLog.create({ data: { organizationId: profile.organizationId, actorId: userId, action: parsed.data.status === "APPROVED" ? "reseller.approved" : "reseller.rejected", targetType: "ResellerProfile", targetId: id } });
    return true;
  });
  if (!changed) return NextResponse.json({ error: "Pengajuan ini sudah ditinjau." }, { status: 409 });
  return NextResponse.json({ updated: true, status: parsed.data.status });
}
