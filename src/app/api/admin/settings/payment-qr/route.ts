import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { getR2Client, getR2Config, r2PublicUrl } from "@/lib/r2";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  if (!await allowRequest(`admin:payment-qr:${userId}`, 10, 3_600)) return NextResponse.json({ error: "Batas unggah QR tercapai. Coba lagi nanti." }, { status: 429 });
  const config = getR2Config();
  if (!config) return NextResponse.json({ error: "Penyimpanan gambar belum tersedia." }, { status: 503 });
  if (!["image/png", "image/jpeg", "image/webp"].includes(request.headers.get("content-type") ?? "")) return NextResponse.json({ error: "Gunakan gambar QR PNG, JPG, atau WebP." }, { status: 400 });
  const maxBytes = 5_000_000;
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return NextResponse.json({ error: "Ukuran gambar maksimal 5 MB." }, { status: 413 });
  const reader = request.body?.getReader();
  if (!reader) return NextResponse.json({ error: "Gambar QR belum dipilih." }, { status: 400 });
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) { await reader.cancel(); return NextResponse.json({ error: "Ukuran gambar maksimal 5 MB." }, { status: 413 }); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let png: Buffer;
  try {
    const image = sharp(Buffer.concat(chunks), { limitInputPixels: 16_000_000, animated: false });
    const metadata = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(metadata.format ?? "") || !metadata.width || !metadata.height || metadata.width < 160 || metadata.height < 160 || (metadata.pages ?? 1) > 1) throw new Error("invalid image");
    png = await image.rotate().png().toBuffer();
    if (png.byteLength > 10_000_000) throw new Error("image too large");
  } catch { return NextResponse.json({ error: "Gambar QR tidak terbaca. Gunakan gambar asli minimal 160 × 160 piksel." }, { status: 400 }); }
  const key = `platform/payment-qr/${randomUUID()}.png`;
  try {
    await getR2Client().send(new PutObjectCommand({ Bucket: config.publicBucket, Key: key, Body: png, ContentType: "image/png", CacheControl: "public, max-age=31536000, immutable" }));
  } catch { return NextResponse.json({ error: "QR belum dapat disimpan. Coba kembali sebentar lagi." }, { status: 502 }); }
  await prisma.auditLog.create({ data: { actorId: userId, action: "admin.payment_qr_uploaded", targetType: "PlatformSetting", targetId: "payment.manual_qr_image_url", metadata: { key, sizeBytes: png.byteLength } } });
  return NextResponse.json({ url: r2PublicUrl(key) }, { status: 201 });
}
