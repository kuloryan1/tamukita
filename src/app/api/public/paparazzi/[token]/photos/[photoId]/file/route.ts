import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { paparazziIsOpen, PAPARAZZI_MAX_BYTES } from "@/lib/paparazzi";
import { getPaparazziUploadPhoto, paparazziInvitationSelect, paparazziPrivateHeaders, paparazziTransactionOptions } from "@/lib/paparazzi-server";
import { stagePaparazziServerFile, PaparazziDiskFullError, PaparazziUploadConflictError } from "@/lib/paparazzi-server-files";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await params;
  const photo = await getPaparazziUploadPhoto(token, photoId, request.headers.get("x-paparazzi-receipt") ?? "");
  if (!photo) return NextResponse.json({ error: "Unggahan tidak ditemukan." }, { status: 404, headers: paparazziPrivateHeaders });
  if (photo.storageProvider !== "SERVER" || photo.status !== "PENDING" || photo.deletedAt) return NextResponse.json({ error: "Unggahan ini tidak dapat diubah." }, { status: 409 });
  if (!paparazziIsOpen(photo.album) || Date.now() - photo.createdAt.getTime() >= 300_000) return NextResponse.json({ error: "Waktu unggah habis atau pengumpulan foto sudah ditutup. Pilih ulang foto." }, { status: 410 });
  const size = Number(photo.sizeBytes); const length = request.headers.get("content-length");
  if (request.headers.get("content-type") !== photo.mimeType || (length !== null && Number(length) !== size) || size > PAPARAZZI_MAX_BYTES || !request.body) return NextResponse.json({ error: "Format atau ukuran unggahan tidak sesuai." }, { status: 400 });
  if (!await allowRequest(`paparazzi:file:${photo.id}`, 20, 900)) return NextResponse.json({ error: "Terlalu banyak percobaan. Tunggu sebentar." }, { status: 429 });
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]);
  const reader = request.body.getReader(); const chunks: Buffer[] = []; let received = 0;
  const abortRead = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", abortRead, { once: true }); if (signal.aborted) abortRead();
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      received += part.value.byteLength;
      if (received > size) { await reader.cancel(); return NextResponse.json({ error: "Foto melebihi ukuran yang diizinkan." }, { status: 413 }); }
      chunks.push(Buffer.from(part.value));
    }
  } catch { return NextResponse.json({ error: "Unggahan terputus. Periksa koneksi dan coba lagi." }, { status: 400 }); }
  finally { signal.removeEventListener("abort", abortRead); reader.releaseLock(); }
  if (signal.aborted) return NextResponse.json({ error: "Waktu unggah habis. Coba lagi." }, { status: 408 });
  if (received !== size) return NextResponse.json({ error: "Foto belum terunggah lengkap. Coba lagi." }, { status: 400 });
  let staged: Awaited<ReturnType<typeof stagePaparazziServerFile>> | undefined;
  try {
    // Flush image bytes before taking database locks; only the atomic link is serialized.
    const prepared = await stagePaparazziServerFile(photo.sourceKey, Buffer.concat(chunks), signal);
    staged = prepared; chunks.length = 0;
    const accepted = await getPrismaClient().$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "paparazzi_albums" WHERE id = ${photo.albumId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "paparazzi_photos" WHERE id = ${photo.id}::uuid FOR UPDATE`;
      const current = await tx.paparazziPhoto.findFirst({ where: { id: photo.id, storageProvider: "SERVER", status: "PENDING", deletedAt: null, retentionAt: { gt: new Date() }, album: { token } }, include: { album: { include: { invitation: { select: paparazziInvitationSelect } } } } });
      if (!current || !paparazziIsOpen(current.album) || Date.now() - current.createdAt.getTime() >= 300_000) return false;
      await prepared.commit(true);
      return true;
    }, paparazziTransactionOptions);
    return accepted ? NextResponse.json({ uploaded: true }, { status: 201, headers: paparazziPrivateHeaders }) : NextResponse.json({ error: "Unggahan sudah ditutup, dihapus, atau QR diganti." }, { status: 410, headers: paparazziPrivateHeaders });
  } catch (error) {
    const code = error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : "UNKNOWN";
    const full = error instanceof PaparazziDiskFullError || code === "ENOSPC" || code === "EDQUOT";
    const conflict = error instanceof PaparazziUploadConflictError;
    if (!conflict) console.error("[paparazzi-upload] write failed", { code: /^[A-Z0-9_]{1,24}$/.test(code) ? code : "UNKNOWN" });
    return NextResponse.json({ error: full ? "Penyimpanan server hampir penuh. Hubungi pemilik acara." : conflict ? error.message : "Foto belum dapat disimpan di server. Coba lagi." }, { status: full ? 507 : conflict ? 409 : 503, headers: paparazziPrivateHeaders });
  } finally { await staged?.dispose(); }
}
