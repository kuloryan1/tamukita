import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { MediaStorageFullError, MediaUploadTooLargeError, mediaServerStore, readMediaRequestBody } from "@/lib/media-server-storage";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID media tidak valid." }, { status: 400 });
  if (!await allowRequest(`media:local-upload:user:${userId}`, 120, 60 * 60)) return NextResponse.json({ error: "Batas unggah media tercapai. Coba lagi nanti." }, { status: 429 });

  const url = new URL(request.url);
  const part = url.searchParams.get("part");
  const revisionKey = url.searchParams.get("revisionKey") ?? "";
  const editSizeBytes = Number(url.searchParams.get("sizeBytes"));
  if (!part || !["original", "crop", "edit"].includes(part) || (part === "edit" && !/^[0-9a-f-]{36}$/i.test(revisionKey))) {
    return NextResponse.json({ error: "Bagian file unggahan tidak valid." }, { status: 400 });
  }
  const prisma = getPrismaClient();
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id,
      uploadedById: userId,
      deletedAt: null,
      storageProvider: "SERVER",
      invitation: {
        ownerId: userId,
        deletedAt: null,
        status: { in: ["DRAFT", "PUBLISHED"] },
        organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } },
      },
    },
    select: { id: true, organizationId: true, invitationId: true, storageKey: true, mimeType: true, sizeBytes: true, status: true, metadata: true },
  });
  if (!asset?.invitationId) return NextResponse.json({ error: "Media tidak ditemukan." }, { status: 404 });

  const metadata = isRecord(asset.metadata) ? asset.metadata : {};
  let key = asset.storageKey;
  let expectedMimeType = asset.mimeType;
  let expectedBytes = Number(asset.sizeBytes);
  if (part === "original" || part === "crop") {
    if (asset.status !== "PENDING") return NextResponse.json({ error: "Unggahan ini sudah tidak dapat diubah." }, { status: 409 });
    if (part === "crop") {
      key = typeof metadata.cropKey === "string" ? metadata.cropKey : "";
      expectedMimeType = typeof metadata.cropMimeType === "string" ? metadata.cropMimeType : "";
      expectedBytes = Number(metadata.cropSizeBytes);
    }
  } else {
    if (asset.status !== "READY" || metadata.mediaKind === "gallery" || metadata.mediaKind === "music") {
      return NextResponse.json({ error: "Foto sampul ini tidak dapat diedit." }, { status: 409 });
    }
    key = `private/pending/${asset.organizationId}/${asset.invitationId}/${asset.id}/edits/${revisionKey}.webp`;
    expectedMimeType = "image/webp";
    expectedBytes = editSizeBytes;
  }

  const maxBytes = expectedBytes;
  if (!key || !Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > (metadata.mediaKind === "music" ? 10_000_000 : 5_000_000)) {
    return NextResponse.json({ error: "Batas file unggahan tidak valid." }, { status: 400 });
  }
  const contentType = request.headers.get("content-type")?.split(";")[0].trim() ?? "";
  if (contentType !== expectedMimeType) return NextResponse.json({ error: "Format file tidak sesuai dengan unggahan." }, { status: 415 });

  try {
    const bytes = await readMediaRequestBody(request, maxBytes);
    if (part !== "edit" && bytes.length !== expectedBytes) return NextResponse.json({ error: "Ukuran file tidak sesuai dengan detail unggahan." }, { status: 400 });
    await mediaServerStore().write(key, bytes);
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MediaUploadTooLargeError) return NextResponse.json({ error: error.message }, { status: 413 });
    if (error instanceof MediaStorageFullError) return NextResponse.json({ error: "Penyimpanan server penuh. Coba lagi setelah ruang tersedia." }, { status: 507 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "File gagal disimpan." }, { status: 400 });
  }
}
