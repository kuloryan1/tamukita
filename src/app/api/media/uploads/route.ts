import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { stripControlCharacters } from "@/lib/text";
import { readJsonBody } from "@/lib/request-json";
import { getTemplate as getStationeryTemplate } from "@/lib/stationery-demo";
import { isAdminSampleSnapshot } from "@/lib/invitation-publication";

export const runtime = "nodejs";

const uploadSchema = z.object({
  invitationId: z.string().uuid(),
  originalName: z.string().trim().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(5_000_000),
  cropContentType: z.enum(["image/png", "image/webp"]),
  cropSizeBytes: z.number().int().positive().max(5_000_000),
  portraitSlot: z.enum(["hostOnePhoto", "hostTwoPhoto"]).optional(),
  cropData: z.object({
    x: z.number().min(0).max(40_000),
    y: z.number().min(0).max(40_000),
    width: z.number().positive().max(40_000),
    height: z.number().positive().max(40_000),
    zoom: z.number().min(1).max(3),
    rotation: z.number().int().min(0).max(270).refine((value) => value % 90 === 0),
    cropOffset: z.object({ x: z.number().min(-40_000).max(40_000), y: z.number().min(-40_000).max(40_000) }).optional(),
  }),
});

const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const cropExtensions = { "image/png": "png", "image/webp": "webp" };

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const body = await readJsonBody(request, 12_000);
  if (!body.ok) return NextResponse.json({ error: "Detail unggahan tidak valid." }, { status: body.status });
  const parsed = uploadSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Foto harus JPG, PNG, atau WebP dengan ukuran maksimal 5 MB." }, { status: 400 });
  if (!await allowRequest(`upload:user:${userId}`, 20, 60 * 60)) return NextResponse.json({ error: "Batas unggah foto tercapai. Coba lagi nanti." }, { status: 429 });

  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: {
      id: parsed.data.invitationId,
      ownerId: userId,
      deletedAt: null,
      status: { in: ["DRAFT", "PUBLISHED"] },
      organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } },
    },
    select: { id: true, organizationId: true, status: true, draftData: true, publishedSnapshot: true },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });
  if (parsed.data.portraitSlot) {
    const draftData = typeof invitation.draftData === "object" && invitation.draftData !== null && !Array.isArray(invitation.draftData)
      ? invitation.draftData as Record<string, unknown>
      : {};
    if (session.user?.platformRole !== "SUPER_ADMIN"
      || typeof draftData.templateId !== "string"
      || !getStationeryTemplate(draftData.templateId)
      || (invitation.status === "PUBLISHED" && !isAdminSampleSnapshot(invitation.publishedSnapshot))) {
      return NextResponse.json({ error: "Foto bingkai hanya tersedia pada contoh Super Admin dengan template bingkai." }, { status: 403 });
    }
  }

  const assetId = randomUUID();
  const safeName = stripControlCharacters(parsed.data.originalName.split(/[\\/]/).pop() ?? "").slice(0, 255) || "foto";
  const storageKey = `originals/${invitation.organizationId}/${invitation.id}/${assetId}/source.${extensions[parsed.data.contentType]}`;
  const cropKey = `private/pending/${invitation.organizationId}/${invitation.id}/${assetId}/${parsed.data.portraitSlot ?? "cover"}.${cropExtensions[parsed.data.cropContentType]}`;
  await prisma.mediaAsset.create({
    data: {
      id: assetId,
      organizationId: invitation.organizationId,
      invitationId: invitation.id,
      uploadedById: userId,
      storageProvider: "SERVER",
      storageKey,
      originalName: safeName,
      mimeType: parsed.data.contentType,
      sizeBytes: BigInt(parsed.data.sizeBytes),
      status: "PENDING",
      visibility: "PRIVATE_SOURCE",
      metadata: {
        cropKey,
        cropSizeBytes: parsed.data.cropSizeBytes,
        cropMimeType: parsed.data.cropContentType,
        ...(parsed.data.portraitSlot ? { mediaKind: "portrait", portraitSlot: parsed.data.portraitSlot } : {}),
      },
      edits: { create: [{ revision: 1, editData: { ...parsed.data.cropData } }] },
    },
  });
  const uploadBase = `/api/media/${assetId}/upload`;
  return NextResponse.json({ assetId, originalUploadUrl: `${uploadBase}?part=original`, croppedUploadUrl: `${uploadBase}?part=crop`, expiresIn: 300 }, { status: 201 });
}
