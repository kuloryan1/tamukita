import { NextResponse } from "next/server";
import { getPrismaClient } from "@/lib/prisma";
import { paparazziWebStore } from "@/lib/paparazzi-web-storage";
import { paparazziPhotoIdSchema, paparazziTokenSchema } from "@/lib/paparazzi";
import { paparazziPrivateHeaders, paparazziPublicPhotoWhere } from "@/lib/paparazzi-server";

export async function GET(request: Request, { params }: { params: Promise<{ token: string; photoId: string }> }) {
  const { token, photoId } = await params;
  if (!paparazziTokenSchema.safeParse(token).success || !paparazziPhotoIdSchema.safeParse(photoId).success) return NextResponse.json({ error: "Foto tidak tersedia." }, { status: 404 });
  const photo = await getPrismaClient().paparazziPhoto.findFirst({ where: paparazziPublicPhotoWhere(token, photoId), select: { id: true, processedKey: true, storageProvider: true } });
  if (!photo) return NextResponse.json({ error: "Foto tidak tersedia." }, { status: 404, headers: paparazziPrivateHeaders });
  try {
    const stream = await paparazziWebStore(photo.storageProvider).read(photo.processedKey);
    return new NextResponse(stream, { headers: { ...paparazziPrivateHeaders, "Content-Type": "image/jpeg", "X-Content-Type-Options": "nosniff", ...(new URL(request.url).searchParams.get("download") === "1" ? { "Content-Disposition": `attachment; filename="paparazi-${photo.id}.jpg"` } : {}) } });
  } catch { return NextResponse.json({ error: "Foto belum dapat dimuat. Coba lagi nanti." }, { status: 503 }); }
}
