import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { getR2Client, getR2Config } from "@/lib/r2";
import { mediaKeyFromPublicUrl } from "@/lib/media-storage-url";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const invitationId = new URL(request.url).searchParams.get("invitationId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(invitationId)) return NextResponse.json({ error: "ID undangan tidak valid." }, { status: 400 });
  if (!await allowRequest(`media:cover-edit:read:user:${userId}`, 30, 60 * 60)) return NextResponse.json({ error: "Batas akses foto tercapai. Coba lagi nanti." }, { status: 429 });
  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: {
      id: invitationId,
      ownerId: userId,
      deletedAt: null,
      status: { in: ["DRAFT", "PUBLISHED"] },
      organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } },
    },
    select: { id: true, draftData: true },
  });
  const draftData = isRecord(invitation?.draftData) ? invitation.draftData : null;
  const coverPhoto = typeof draftData?.coverPhoto === "string" ? draftData.coverPhoto : "";
  const coverKey = mediaKeyFromPublicUrl(coverPhoto);
  if (!invitation || !coverKey) return NextResponse.json({ error: "Foto sampul tidak dapat diedit." }, { status: 404 });

  const variant = await prisma.mediaVariant.findFirst({
    where: {
      storageKey: coverKey,
      variantKey: "cover",
      mediaAsset: { invitationId, uploadedById: userId, status: "READY", deletedAt: null },
    },
    select: {
      mediaAsset: {
        select: {
          id: true,
          storageProvider: true,
          storageKey: true,
          originalName: true,
          mimeType: true,
          edits: { orderBy: { revision: "desc" }, take: 1, select: { revision: true, editData: true } },
        },
      },
    },
  });
  if (!variant) return NextResponse.json({ error: "File sumber privat foto ini tidak tersedia untuk diedit." }, { status: 404 });

  let sourceUrl: string;
  if (variant.mediaAsset.storageProvider === "SERVER") {
    sourceUrl = `/api/media/${variant.mediaAsset.id}/source`;
  } else {
    const config = getR2Config();
    if (!config) return NextResponse.json({ error: "Penyimpanan foto lama belum tersedia." }, { status: 503 });
    sourceUrl = await getSignedUrl(
      getR2Client(),
      new GetObjectCommand({ Bucket: config.privateBucket, Key: variant.mediaAsset.storageKey }),
      { expiresIn: 300 },
    );
  }
  const latestEdit = variant.mediaAsset.edits[0];
  return NextResponse.json({
    assetId: variant.mediaAsset.id,
    sourceUrl,
    originalName: variant.mediaAsset.originalName,
    contentType: variant.mediaAsset.mimeType,
    baseRevision: latestEdit?.revision ?? 0,
    cropData: isRecord(latestEdit?.editData) ? latestEdit.editData : null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
