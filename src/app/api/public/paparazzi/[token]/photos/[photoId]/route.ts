import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { ensurePaparazziStorage } from "@/lib/paparazzi-web-storage";
import { PAPARAZZI_UPLOAD_TTL_MS, paparazziIsOpen, paparazziReceiptSchema } from "@/lib/paparazzi";
import { paparazziInvitationSelect, paparazziPrivateHeaders, paparazziTransactionOptions, getPaparazziUploadPhoto as getPhoto } from "@/lib/paparazzi-server";


export async function GET(request: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await params;
  const photo = await getPhoto(token, photoId, request.headers.get("x-paparazzi-receipt") ?? "");
  if (!photo) return NextResponse.json({ error: "Unggahan tidak ditemukan." }, { status: 404, headers: paparazziPrivateHeaders });
  if (!await allowRequest(`paparazzi:status:${photo.id}`, 240, 900)) return NextResponse.json({ error: "Tunggu sebentar sebelum memeriksa lagi." }, { status: 429 });
  if (photo.status === "FAILED") return NextResponse.json({ status: "FAILED", error: "Foto tidak dapat diproses. Pilih foto JPG, PNG, atau WebP yang valid." }, { status: 422, headers: paparazziPrivateHeaders });
  if (photo.deletedAt || photo.status === "DELETED") return NextResponse.json({ error: "Unggahan tidak tersedia." }, { status: 410, headers: paparazziPrivateHeaders });
  return NextResponse.json({ status: photo.status, visible: photo.isVisible }, { headers: paparazziPrivateHeaders });
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await params;
  const body = await readJsonBody(request, 1_000); if (!body.ok) return NextResponse.json({ error: "Konfirmasi unggahan tidak valid." }, { status: body.status });
  const parsed = paparazziReceiptSchema.safeParse(body.value);
  const photo = parsed.success ? await getPhoto(token, photoId, parsed.data.receipt) : null;
  if (!photo) return NextResponse.json({ error: "Unggahan tidak ditemukan." }, { status: 404, headers: paparazziPrivateHeaders });
  if (photo.status === "READY") return NextResponse.json({ status: "READY" }, { headers: paparazziPrivateHeaders });
  if (photo.deletedAt || photo.status === "FAILED" || photo.status === "DELETED") return NextResponse.json({ error: "Foto ini tidak dapat diproses. Pilih foto lain." }, { status: 409 });
  if (!paparazziIsOpen(photo.album)) return NextResponse.json({ error: "Pengumpulan foto sudah ditutup." }, { status: 410 });
  if (photo.status === "PENDING" && Date.now() - photo.createdAt.getTime() > PAPARAZZI_UPLOAD_TTL_MS) return NextResponse.json({ error: "Waktu unggah habis. Pilih foto lagi untuk memulai ulang." }, { status: 410 });
  try { await ensurePaparazziStorage(photo.storageProvider); } catch { return NextResponse.json({ error: "Penyimpanan foto belum tersedia." }, { status: 503 }); }
  if (!await allowRequest(`paparazzi:complete:${photo.id}`, 30, 900)) return NextResponse.json({ error: "Terlalu banyak konfirmasi. Periksa lagi sebentar." }, { status: 429 });
  const startedAt = new Date();
  const accepted = await getPrismaClient().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "paparazzi_albums" WHERE id = ${photo.albumId}::uuid FOR UPDATE`;
    const current = await tx.paparazziAlbum.findFirst({ where: { id: photo.albumId, token }, include: { invitation: { select: paparazziInvitationSelect } } });
    if (!current || !paparazziIsOpen(current)) return false;
    const claim = await tx.paparazziPhoto.updateMany({ where: { id: photo.id, status: "PENDING", deletedAt: null }, data: { status: "PROCESSING", processingStartedAt: startedAt } });
    if (claim.count) await tx.notificationJob.create({ data: { jobKey: `paparazzi-process:${photo.id}`, jobType: "PAPARAZZI_PROCESSING", payload: { photoId: photo.id, processingStartedAt: startedAt.toISOString() } } });
    return true;
  }, paparazziTransactionOptions);
  if (!accepted) return NextResponse.json({ error: "Pengumpulan foto sudah ditutup atau QR sudah diganti." }, { status: 410 });
  return NextResponse.json({ status: "PROCESSING" }, { status: 202, headers: paparazziPrivateHeaders });
}
