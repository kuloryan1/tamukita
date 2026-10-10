import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { getR2Config, r2PublicUrl } from "@/lib/r2";

export const runtime = "nodejs";

const maxSourceBytes = 5_000_000;
const maxMusicBytes = 10_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function statusResponse(status: string, publicUrl?: string) {
  if (status === "READY" && publicUrl) return NextResponse.json({ status, publicUrl }, { headers: { "Cache-Control": "private, no-store" } });
  if (status === "FAILED") return NextResponse.json({ status, error: "Media gagal diproses. Pilih file yang valid dan coba lagi." }, { status: 422, headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ status: "PROCESSING" }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID media tidak valid." }, { status: 400 });
  if (!getR2Config()) return NextResponse.json({ error: "Cloudflare R2 belum dikonfigurasi di server." }, { status: 503 });
  if (!await allowRequest(`media:complete:user:${userId}`, 30, 60 * 60)) return NextResponse.json({ error: "Batas pemrosesan media tercapai. Coba lagi nanti." }, { status: 429 });

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
  });
  if (!asset) return NextResponse.json({ error: "Media tidak ditemukan." }, { status: 404 });
  const assetMetadata = isRecord(asset.metadata) ? asset.metadata : {};
  const mediaKind = assetMetadata.mediaKind === "gallery" || assetMetadata.mediaKind === "music" ? assetMetadata.mediaKind : "cover";
  const variantKey = mediaKind;
  if (asset.status === "READY") {
    const ready = await prisma.mediaVariant.findUnique({ where: { mediaAssetId_variantKey: { mediaAssetId: asset.id, variantKey } }, select: { storageKey: true } });
    if (ready) return statusResponse("READY", r2PublicUrl(ready.storageKey));
  }
  const maximumSize = mediaKind === "music" ? maxMusicBytes : maxSourceBytes;
  if (asset.status === "FAILED" || asset.status === "DELETED" || asset.sizeBytes > BigInt(maximumSize)) {
    return NextResponse.json({ error: "Media ini tidak dapat diproses." }, { status: 409 });
  }
  if (asset.status !== "PENDING" && asset.status !== "PROCESSING") {
    return NextResponse.json({ error: "Media ini tidak dapat diproses." }, { status: 409 });
  }

  const cropKey = typeof assetMetadata.cropKey === "string" ? assetMetadata.cropKey : "";
  const cropSizeBytes = Number(assetMetadata.cropSizeBytes);
  const cropMimeType = assetMetadata.cropMimeType;
  if (mediaKind === "cover" && (!cropKey.startsWith(`private/pending/${asset.organizationId}/${asset.invitationId}/${asset.id}/`)
    || !Number.isSafeInteger(cropSizeBytes)
    || cropSizeBytes < 1
    || cropSizeBytes > maxSourceBytes
    || (cropMimeType !== "image/png" && cropMimeType !== "image/webp"))) {
    return NextResponse.json({ error: "Foto ini tidak memiliki data crop yang valid." }, { status: 409 });
  }

  const startedAt = new Date();
  const staleBefore = new Date(startedAt.getTime() - 15 * 60 * 1000);
  const reserved = await prisma.$transaction(async (tx) => {
    const reservation = await tx.mediaAsset.updateMany({
      where: asset.status === "PENDING"
        ? { id: asset.id, status: "PENDING" }
        : { id: asset.id, status: "PROCESSING", OR: [{ processingStartedAt: { lt: staleBefore } }, { processingStartedAt: null }] },
      data: { status: "PROCESSING", processingStartedAt: startedAt },
    });
    if (reservation.count !== 1) return false;
    await tx.notificationJob.create({
      data: {
        jobKey: `media-processing:${asset.id}:${startedAt.getTime()}`,
        jobType: "MEDIA_PROCESSING",
        payload: { mediaAssetId: asset.id, processingStartedAt: startedAt.toISOString() },
      },
    });
    return true;
  });

  if (reserved) return statusResponse("PROCESSING");
  const current = await prisma.mediaAsset.findUnique({ where: { id: asset.id }, select: { status: true } });
  if (current?.status === "READY") {
    const ready = await prisma.mediaVariant.findUnique({ where: { mediaAssetId_variantKey: { mediaAssetId: asset.id, variantKey } }, select: { storageKey: true } });
    if (ready) return statusResponse("READY", r2PublicUrl(ready.storageKey));
  }
  if (current?.status === "FAILED") return statusResponse("FAILED");
  return statusResponse("PROCESSING");
}
