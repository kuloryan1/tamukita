import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { mediaServerStore } from "@/lib/media-server-storage";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID media tidak valid." }, { status: 400 });

  const asset = await getPrismaClient().mediaAsset.findFirst({
    where: {
      id,
      uploadedById: userId,
      storageProvider: "SERVER",
      status: "READY",
      deletedAt: null,
      invitation: {
        ownerId: userId,
        deletedAt: null,
        status: { in: ["DRAFT", "PUBLISHED"] },
        organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } },
      },
    },
    select: { storageKey: true, mimeType: true, metadata: true },
  });
  const metadata = isRecord(asset?.metadata) ? asset.metadata : {};
  if (!asset || metadata.mediaKind === "gallery" || metadata.mediaKind === "music") return NextResponse.json({ error: "File sumber tidak ditemukan." }, { status: 404 });
  try {
    const body = await mediaServerStore().stream(asset.storageKey);
    return new Response(body, { headers: { "Content-Type": asset.mimeType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return NextResponse.json({ error: "File sumber tidak tersedia." }, { status: 404 });
  }
}
