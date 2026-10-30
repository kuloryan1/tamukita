import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { paparazziOwnerWhere, paparazziPrivateHeaders } from "@/lib/paparazzi-server";
import { paparazziUrl } from "@/lib/paparazzi";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user?.id) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "QR tidak ditemukan." }, { status: 404 });
  const album = await getPrismaClient().paparazziAlbum.findFirst({ where: { invitationId: id, invitation: paparazziOwnerWhere(session.user.id, id) }, select: { token: true } });
  if (!album) return NextResponse.json({ error: "Siapkan Paparazi terlebih dahulu." }, { status: 404 });
  const url = paparazziUrl(album.token, process.env.NEXT_PUBLIC_APP_URL || "https://tamukita.io");
  const query = new URL(request.url).searchParams; const png = query.get("format") === "png";
  const options = { errorCorrectionLevel: "M" as const, margin: 4, width: 800 };
  const content = png ? new Uint8Array(await QRCode.toBuffer(url, { ...options, type: "png" })) : await QRCode.toString(url, { ...options, type: "svg" });
  return new NextResponse(content, { headers: { ...paparazziPrivateHeaders, "Content-Type": png ? "image/png" : "image/svg+xml", ...(query.get("download") === "1" ? { "Content-Disposition": `attachment; filename="paparazi-${id}.${png ? "png" : "svg"}"` } : {}) } });
}
