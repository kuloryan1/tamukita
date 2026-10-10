import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { r2PublicUrl } from "@/lib/r2";

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
  if (!await allowRequest(`media:status:user:${userId}`, 240, 60 * 60)) return NextResponse.json({ error: "Batas pemeriksaan status media tercapai." }, { status: 429 });

  const prisma = getPrismaClient();
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id,
      uploadedById: userId,
      deletedAt: null,
      invitation: {
        ownerId: userId,
        deletedAt: null,
        status: { in: ["DRAFT", "PUBLISHED"] },
        organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } },
      },
    },
    select: { status: true, metadata: true },
  });
  if (!asset) return NextResponse.json({ error: "Media tidak ditemukan." }, { status: 404 });
  if (asset.status === "FAILED") return NextResponse.json({ status: "FAILED", error: "Media gagal diproses. Pilih file yang valid dan coba lagi." }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  if (asset.status !== "READY") return NextResponse.json({ status: asset.status }, { status: 200, headers: { "Cache-Control": "private, no-store" } });

  const metadata = isRecord(asset.metadata) ? asset.metadata : {};
  const variantKey = metadata.mediaKind === "gallery" || metadata.mediaKind === "music" ? metadata.mediaKind : "cover";
  const variant = await prisma.mediaVariant.findUnique({
    where: { mediaAssetId_variantKey: { mediaAssetId: id, variantKey } },
    select: { storageKey: true },
  });
  if (!variant) return NextResponse.json({ error: "Hasil media belum tersedia." }, { status: 503 });
  return NextResponse.json({ status: "READY", publicUrl: r2PublicUrl(variant.storageKey) }, { headers: { "Cache-Control": "private, no-store" } });
}
