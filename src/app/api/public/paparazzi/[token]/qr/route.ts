import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { paparazziGalleryVisible, paparazziUrl } from "@/lib/paparazzi";
import { getPaparazziAlbumByToken, paparazziPrivateHeaders } from "@/lib/paparazzi-server";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const album = await getPaparazziAlbumByToken(token);
  if (!album || !paparazziGalleryVisible(album.invitation)) {
    return NextResponse.json({ error: "Galeri acara tidak tersedia." }, { status: 404, headers: paparazziPrivateHeaders });
  }

  const url = paparazziUrl(album.token, process.env.NEXT_PUBLIC_APP_URL || "https://tamukita.io");
  const svg = await QRCode.toString(url, { errorCorrectionLevel: "M", margin: 3, width: 800, type: "svg" });
  return new NextResponse(svg, {
    headers: { ...paparazziPrivateHeaders, "Content-Type": "image/svg+xml; charset=utf-8" },
  });
}
