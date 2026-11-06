import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { mediaServerFilePath, mediaServerStore } from "@/lib/media-server-storage";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const { key: segments } = await params;
  if (!Array.isArray(segments) || !segments.length) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  const key = segments.join("/");
  try {
    mediaServerFilePath(key);
  } catch {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  const variant = await getPrismaClient().mediaVariant.findFirst({
    where: { storageKey: key, mediaAsset: { storageProvider: "SERVER", status: "READY", deletedAt: null } },
    select: {
      mimeType: true,
      sizeBytes: true,
      mediaAsset: {
        select: {
          invitation: { select: { ownerId: true, status: true, deletedAt: true, organization: { select: { status: true } } } },
        },
      },
    },
  });
  const invitation = variant?.mediaAsset.invitation;
  if (!variant || !invitation || invitation.deletedAt || invitation.organization.status !== "ACTIVE") {
    return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  const isPublic = invitation.status === "PUBLISHED";
  if (!isPublic) {
    const userId = (await auth())?.user?.id;
    if (!userId || userId !== invitation.ownerId) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
  }

  try {
    const body = await mediaServerStore().stream(key);
    return new Response(body, {
      headers: {
        "Content-Type": variant.mimeType,
        "Content-Length": variant.sizeBytes.toString(),
        "Cache-Control": isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "File tidak tersedia." }, { status: 404 });
  }
}
