import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";
const requestSchema = z.object({ reason: z.string().trim().min(15).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID undangan tidak valid." }, { status: 400 });
  const body = await readJsonBody(request, 2_000);
  if (!body.ok) return NextResponse.json({ error: "Alasan akses tidak valid." }, { status: body.status });
  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Jelaskan alasan akses minimal 15 karakter." }, { status: 400 });
  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  if (!await allowRequest(`admin:support-access:create:${userId}`, 10, 60 * 60)) return NextResponse.json({ error: "Batas pembukaan akses bantuan tercapai. Coba lagi nanti." }, { status: 429 });

  const invitation = await prisma.invitation.findFirst({
    where: { id, deletedAt: null, organization: { type: { not: "PLATFORM" } } },
    select: { id: true, organizationId: true, title: true },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
  const grantId = randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.supportAccessGrant.create({ data: { id: grantId, adminId: userId, organizationId: invitation.organizationId, invitationId: invitation.id, reason: parsed.data.reason, expiresAt } });
    await tx.auditLog.create({
      data: { organizationId: invitation.organizationId, actorId: userId, action: "admin.support_access_granted", targetType: "SupportAccessGrant", targetId: grantId, metadata: { invitationId: invitation.id, invitationTitle: invitation.title, reason: parsed.data.reason, expiresAt: expiresAt.toISOString() } },
    });
  });
  return NextResponse.json({ grantId, expiresAt: expiresAt.toISOString() }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
