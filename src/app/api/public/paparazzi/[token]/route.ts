import { NextResponse } from "next/server";
import { getPublicPaparazziAlbum, paparazziPrivateHeaders } from "@/lib/paparazzi-server";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const album = await getPublicPaparazziAlbum(token);
  return album ? NextResponse.json(album, { headers: paparazziPrivateHeaders }) : NextResponse.json({ error: "QR acara tidak tersedia. Minta QR terbaru kepada pemilik acara." }, { status: 404, headers: paparazziPrivateHeaders });
}
