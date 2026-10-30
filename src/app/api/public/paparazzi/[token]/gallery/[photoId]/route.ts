import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { getR2Client, getR2Config } from "@/lib/r2";
import { paparazziPhotoIdSchema, paparazziTokenSchema } from "@/lib/paparazzi";
import { paparazziPrivateHeaders, paparazziPublicPhotoWhere } from "@/lib/paparazzi-server";

export async function GET(request: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await params;
  if (!paparazziTokenSchema.safeParse(token).success || !paparazziPhotoIdSchema.safeParse(photoId).success) return NextResponse.json({ error: "Foto tidak tersedia." }, { status: 404 });
  const photo = await getPrismaClient().paparazziPhoto.findFirst({ where: paparazziPublicPhotoWhere(token, photoId), select: { id: true, processedKey: true } });
  if (!photo) return NextResponse.json({ error: "Foto tidak tersedia." }, { status: 404, headers: paparazziPrivateHeaders });
  const config = getR2Config(); if (!config) return NextResponse.json({ error: "Penyimpanan foto belum tersedia." }, { status: 503 });
  try {
    const object = await getR2Client().send(new GetObjectCommand({ Bucket: config.privateBucket, Key: photo.processedKey }));
    if (!object.Body) throw new Error("Empty photo");
    return new NextResponse(object.Body.transformToWebStream(), { headers: { ...paparazziPrivateHeaders, "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", ...(new URL(request.url).searchParams.get("download") === "1" ? { "Content-Disposition": `attachment; filename="paparazi-${photo.id}.jpg"` } : {}) } });
  } catch { return NextResponse.json({ error: "Foto belum dapat dimuat. Coba lagi nanti." }, { status: 503 }); }
}
