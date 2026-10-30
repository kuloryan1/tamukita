import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrismaClient } from "@/lib/prisma";
import { paparazziGalleryVisible } from "@/lib/paparazzi";
import { getPaparazziAlbumByToken, paparazziPrivateHeaders, paparazziPublicPhotoWhere } from "@/lib/paparazzi-server";

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const cursor = new URL(request.url).searchParams.get("cursor");
  if (cursor && !z.string().uuid().safeParse(cursor).success) return NextResponse.json({ error: "Halaman galeri tidak valid." }, { status: 400 });
  const album = await getPaparazziAlbumByToken(token);
  if (!album || !paparazziGalleryVisible(album.invitation)) return NextResponse.json({ error: "Galeri acara tidak tersedia." }, { status: 404, headers: paparazziPrivateHeaders });
  const photos = await getPrismaClient().paparazziPhoto.findMany({ where: paparazziPublicPhotoWhere(token), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 25, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}), select: { id: true, width: true, height: true, createdAt: true } });
  return NextResponse.json({ photos: photos.slice(0, 24).map(photo => ({ ...photo, createdAt: photo.createdAt.toISOString() })), nextCursor: photos.length > 24 ? photos[23].id : null }, { headers: paparazziPrivateHeaders });
}
