import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { getApprovedReseller } from "@/lib/reseller-server";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const staffSchema = z.object({ email: z.email().trim().toLowerCase().max(254) });

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const reseller = await getApprovedReseller(userId);
  if (!reseller) return NextResponse.json({ error: "Akun reseller belum disetujui." }, { status: 403 });
  const prisma = getPrismaClient();
  const [actorMembership, members] = await Promise.all([
    prisma.membership.findFirst({ where: { organizationId: reseller.organizationId, userId }, select: { role: true } }),
    prisma.membership.findMany({
      where: { organizationId: reseller.organizationId, role: "RESELLER_STAFF" },
      orderBy: { createdAt: "asc" },
      select: { id: true, createdAt: true, user: { select: { name: true, email: true } } },
    }),
  ]);
  return NextResponse.json({ canManage: actorMembership?.role === "OWNER", staff: members.map((member) => ({ id: member.id, name: member.user.name ?? "Anggota", email: member.user.email ?? "", createdAt: member.createdAt.toISOString() })) });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const reseller = await getApprovedReseller(userId);
  if (!reseller) return NextResponse.json({ error: "Akun reseller belum disetujui." }, { status: 403 });
  const prisma = getPrismaClient();
  const ownerMembership = await prisma.membership.findFirst({ where: { organizationId: reseller.organizationId, userId, role: "OWNER" }, select: { id: true } });
  if (!ownerMembership) return NextResponse.json({ error: "Hanya pemilik workspace reseller yang dapat mengelola staf." }, { status: 403 });
  if (!await allowRequest(`reseller:staff:${userId}`, 20, 60 * 60)) return NextResponse.json({ error: "Terlalu banyak perubahan staf. Coba lagi nanti." }, { status: 429 });
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Email staf tidak valid." }, { status: body.status });
  const parsed = staffSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Masukkan alamat email akun TamuKita yang valid." }, { status: 400 });
  const staffUser = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, name: true, email: true } });
  if (!staffUser) return NextResponse.json({ error: "Akun staf belum ditemukan. Minta orang tersebut mendaftar terlebih dahulu." }, { status: 404 });
  if (staffUser.id === userId) return NextResponse.json({ error: "Pemilik sudah memiliki akses ke workspace ini." }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({ where: { organizationId_userId: { organizationId: reseller.organizationId, userId: staffUser.id } }, select: { id: true, role: true } });
    if (existing?.role === "OWNER" || existing?.role === "ADMIN") return { conflict: true as const };
    const membership = await tx.membership.upsert({
      where: { organizationId_userId: { organizationId: reseller.organizationId, userId: staffUser.id } },
      create: { organizationId: reseller.organizationId, userId: staffUser.id, role: "RESELLER_STAFF" },
      update: { role: "RESELLER_STAFF" },
      select: { id: true },
    });
    await tx.auditLog.create({ data: { organizationId: reseller.organizationId, actorId: userId, action: "reseller.staff_added", targetType: "User", targetId: staffUser.id, metadata: { email: staffUser.email } } });
    if (staffUser.email) {
      await tx.notificationJob.upsert({
        where: { jobKey: `reseller-staff-added:${membership.id}` },
        create: {
          jobKey: `reseller-staff-added:${membership.id}`,
          jobType: "RESELLER_STAFF_ADDED_EMAIL",
          payload: { to: staffUser.email, name: staffUser.name ?? "", resellerName: reseller.businessName, dashboardPath: "/reseller" },
        },
        update: {},
      });
    }
    return { conflict: false as const, membershipId: membership.id };
  });
  if (result.conflict) return NextResponse.json({ error: "Akun ini sudah memiliki peran pemilik atau admin." }, { status: 409 });
  return NextResponse.json({ added: true, membershipId: result.membershipId }, { status: 201 });
}
