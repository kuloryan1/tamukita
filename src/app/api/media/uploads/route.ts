import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { getR2Client, getR2Config } from "@/lib/r2";
import { stripControlCharacters } from "@/lib/text";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const uploadSchema = z.object({
  invitationId: z.string().uuid(),
  originalName: z.string().trim().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(5_000_000),
  cropContentType: z.enum(["image/png", "image/webp"]),
  cropSizeBytes: z.number().int().positive().max(5_000_000),
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
  const config = getR2Config();
  if (!config) return NextResponse.json({ error: "Cloudflare R2 belum dikonfigurasi di server." }, { status: 503 });
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
    select: { id: true, organizationId: true },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });

  const assetId = randomUUID();
  const safeName = stripControlCharacters(parsed.data.originalName.split(/[\\/]/).pop() ?? "").slice(0, 255) || "foto";
  const storageKey = `originals/${invitation.organizationId}/${invitation.id}/${assetId}/source.${extensions[parsed.data.contentType]}`;
  const cropKey = `private/pending/${invitation.organizationId}/${invitation.id}/${assetId}/cover.${cropExtensions[parsed.data.cropContentType]}`;
  const s3 = getR2Client();
  const [originalUploadUrl, croppedUploadUrl] = await Promise.all([
    getSignedUrl(s3, new PutObjectCommand({ Bucket: config.privateBucket, Key: storageKey, ContentType: parsed.data.contentType, ContentLength: parsed.data.sizeBytes }), { expiresIn: 300 }),
    getSignedUrl(s3, new PutObjectCommand({ Bucket: config.privateBucket, Key: cropKey, ContentType: parsed.data.cropContentType, ContentLength: parsed.data.cropSizeBytes }), { expiresIn: 300 }),
  ]);
  await prisma.mediaAsset.create({
    data: {
      id: assetId,
      organizationId: invitation.organizationId,
      invitationId: invitation.id,
      uploadedById: userId,
      storageKey,
      originalName: safeName,
      mimeType: parsed.data.contentType,
      sizeBytes: BigInt(parsed.data.sizeBytes),
      status: "PENDING",
      visibility: "PRIVATE_SOURCE",
      metadata: { cropKey, cropSizeBytes: parsed.data.cropSizeBytes, cropMimeType: parsed.data.cropContentType },
      edits: { create: [{ revision: 1, editData: { ...parsed.data.cropData } }] },
    },
  });
  return NextResponse.json({ assetId, originalUploadUrl, croppedUploadUrl, expiresIn: 300 }, { status: 201 });
}
