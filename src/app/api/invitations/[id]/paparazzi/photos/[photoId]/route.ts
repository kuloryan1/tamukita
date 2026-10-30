import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { getR2Client, getR2Config } from "@/lib/r2";
import { paparazziOwnerWhere, paparazziPrivateHeaders } from "@/lib/paparazzi-server";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { PAPARAZZI_CONSENT_VERSION } from "@/lib/paparazzi";
import { PAPARAZZI_CHILD_DATA_GUARDIAN_CONSENT_VERSION } from "@/lib/consent-versions";

async function context(params: Promise<{ id: string; photoId: string }>) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Silakan masuk terlebih dahulu.", status: 401 } as const;
  const { id, photoId } = await params;
  if (!z.string().uuid().safeParse(id).success || !z.string().uuid().safeParse(photoId).success) return { error: "Foto tidak ditemukan.", status: 404 } as const;
  const photo = await getPrismaClient().paparazziPhoto.findFirst({ where: { id: photoId, deletedAt: null, retentionAt: { gt: new Date() }, album: { invitationId: id, invitation: paparazziOwnerWhere(session.user.id, id) } } });
  return photo ? { photo, userId: session.user.id } as const : { error: "Foto tidak ditemukan.", status: 404 } as const;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const result = await context(params);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (result.photo.status !== "READY") return NextResponse.json({ error: "Foto masih diproses." }, { status: 409 });
  const config = getR2Config(); if (!config) return NextResponse.json({ error: "Penyimpanan foto belum tersedia." }, { status: 503 });
  try {
    const object = await getR2Client().send(new GetObjectCommand({ Bucket: config.privateBucket, Key: result.photo.processedKey }));
    if (!object.Body) throw new Error("Empty object");
    return new NextResponse(object.Body.transformToWebStream(), { headers: { ...paparazziPrivateHeaders, "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", ...(new URL(request.url).searchParams.get("download") === "1" ? { "Content-Disposition": `attachment; filename="paparazi-${result.photo.id}.jpg"` } : {}) } });
  } catch { return NextResponse.json({ error: "Foto belum dapat dimuat. Coba lagi nanti." }, { status: 503 }); }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const result = await context(params);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  if (!await allowRequest(`paparazzi:delete:${result.userId}`, 300, 3_600)) return NextResponse.json({ error: "Terlalu banyak perubahan. Coba lagi nanti." }, { status: 429 });
  await getPrismaClient().$transaction(async tx => {
    const updated = await tx.paparazziPhoto.updateMany({ where: { id: result.photo.id, deletedAt: null, album: { invitation: paparazziOwnerWhere(result.userId) } }, data: { status: "DELETED", deletedAt: new Date() } });
    if (updated.count) {
      await tx.notificationJob.create({ data: { jobKey: `paparazzi-delete:${result.photo.id}`, jobType: "PAPARAZZI_DELETE", payload: { photoId: result.photo.id } } });
      await tx.auditLog.create({ data: { actorId: result.userId, action: "paparazzi.photo_deleted", targetType: "PaparazziPhoto", targetId: result.photo.id } });
    }
  });
  return NextResponse.json({ deleted: true }, { headers: paparazziPrivateHeaders });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const result = await context(params);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  const body = await readJsonBody(request, 1_000); if (!body.ok) return NextResponse.json({ error: "Pengaturan foto tidak valid." }, { status: body.status });
  const parsed = z.object({ visible: z.boolean() }).strict().safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih apakah foto ditampilkan atau disembunyikan." }, { status: 400 });
  if (!await allowRequest(`paparazzi:visibility:${result.userId}`, 300, 3_600)) return NextResponse.json({ error: "Terlalu banyak perubahan. Coba lagi nanti." }, { status: 429 });
  if (parsed.data.visible && (result.photo.consentVersion !== PAPARAZZI_CONSENT_VERSION || (result.photo.includesChildData && (!result.photo.guardianConsentAt || result.photo.guardianConsentVersion !== PAPARAZZI_CHILD_DATA_GUARDIAN_CONSENT_VERSION)))) return NextResponse.json({ error: "Foto ini tidak memiliki persetujuan untuk galeri publik." }, { status: 409 });
  const updated = await getPrismaClient().$transaction(async tx => {
    const change = await tx.paparazziPhoto.updateMany({ where: { id: result.photo.id, deletedAt: null, album: { invitation: paparazziOwnerWhere(result.userId) } }, data: { isVisible: parsed.data.visible } });
    if (change.count) await tx.auditLog.create({ data: { actorId: result.userId, action: "paparazzi.visibility_updated", targetType: "PaparazziPhoto", targetId: result.photo.id, metadata: { visible: parsed.data.visible } } });
    return change;
  });
  if (updated.count !== 1) return NextResponse.json({ error: "Status foto sudah berubah. Muat ulang galeri." }, { status: 409 });
  return NextResponse.json({ visible: parsed.data.visible }, { headers: paparazziPrivateHeaders });
}
