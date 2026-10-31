import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { ensurePaparazziStorage } from "@/lib/paparazzi-web-storage";
import { getOwnerPaparazziAlbum, paparazziInvitationSelect, paparazziOwnerWhere, paparazziPrivateHeaders, paparazziTransactionOptions } from "@/lib/paparazzi-server";

const schema = z.object({ enabled: z.boolean().optional(), closesAt: z.string().datetime().optional(), rotateQr: z.literal(true).optional() }).strict().refine(value => Object.keys(value).length > 0);

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user?.id) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params; const cursor = new URL(request.url).searchParams.get("cursor");
  if (!z.string().uuid().safeParse(id).success || (cursor && !z.string().uuid().safeParse(cursor).success)) return NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });
  const result = await getOwnerPaparazziAlbum(session.user.id, id, cursor ?? undefined);
  return result ? NextResponse.json(result, { headers: paparazziPrivateHeaders }) : NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });
  const body = await readJsonBody(request, 2_000); if (!body.ok) return NextResponse.json({ error: "Pengaturan tidak valid." }, { status: body.status });
  const parsed = schema.safeParse(body.value); if (!parsed.success) return NextResponse.json({ error: "Pengaturan Paparazi tidak valid." }, { status: 400 });
  if (!await allowRequest(`paparazzi:settings:${userId}`, 60, 3_600)) return NextResponse.json({ error: "Terlalu banyak perubahan. Coba lagi nanti." }, { status: 429 });
  if (parsed.data.enabled) { try { await ensurePaparazziStorage(); } catch { return NextResponse.json({ error: "Penyimpanan foto belum tersedia." }, { status: 503 }); } }
  const prisma = getPrismaClient();
  const result = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "invitations" WHERE id = ${id}::uuid FOR UPDATE`;
    const invitation = await tx.invitation.findFirst({ where: paparazziOwnerWhere(userId, id), select: { ...paparazziInvitationSelect, paparazziAlbum: true } });
    if (!invitation) return { error: "Undangan tidak ditemukan.", status: 404 };
    const now = new Date(); const existing = invitation.paparazziAlbum;
    const defaultClose = new Date(Math.max(now.getTime(), invitation.startsAt?.getTime() ?? now.getTime()) + 7 * 86_400_000);
    const closesAt = parsed.data.closesAt ? new Date(parsed.data.closesAt) : existing?.closesAt ?? new Date(Math.min(defaultClose.getTime(), invitation.expiresAt?.getTime() ?? defaultClose.getTime()));
    if (parsed.data.enabled === true && (invitation.status !== "PUBLISHED" || !invitation.expiresAt || invitation.expiresAt <= now)) return { error: "Terbitkan undangan dengan masa hosting aktif sebelum membuka unggahan.", status: 409 };
    if ((parsed.data.closesAt || parsed.data.enabled === true) && (closesAt <= now || (invitation.expiresAt && closesAt > invitation.expiresAt))) return { error: "Pilih waktu tutup setelah sekarang dan sebelum masa hosting berakhir.", status: 400 };
    const album = await tx.paparazziAlbum.upsert({
      where: { invitationId: id },
      create: { invitationId: id, token: randomBytes(32).toString("hex"), enabled: parsed.data.enabled ?? false, closesAt },
      update: { ...(parsed.data.enabled !== undefined ? { enabled: parsed.data.enabled } : {}), closesAt, ...(parsed.data.rotateQr ? { token: randomBytes(32).toString("hex") } : {}) },
    });
    await tx.auditLog.create({ data: { actorId: userId, organizationId: invitation.organizationId, action: "paparazzi.settings_updated", targetType: "PaparazziAlbum", targetId: album.id, metadata: { enabled: album.enabled, closesAt: album.closesAt.toISOString(), qrRotated: Boolean(parsed.data.rotateQr), visibility: "PUBLIC_EVENT_GALLERY" } } });
    return { error: null, status: 200 };
  }, paparazziTransactionOptions);
  if (result.error) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(await getOwnerPaparazziAlbum(userId, id), { headers: paparazziPrivateHeaders });
}
