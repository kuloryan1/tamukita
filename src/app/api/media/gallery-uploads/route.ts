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

const schema = z.object({
  invitationId: z.string().uuid(),
  originalName: z.string().trim().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  sizeBytes: z.number().int().positive().max(5_000_000),
});

const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const config = getR2Config();
  if (!config) return NextResponse.json({ error: "Cloudflare R2 belum dikonfigurasi di server." }, { status: 503 });
  const body = await readJsonBody(request, 8_000);
  if (!body.ok) return NextResponse.json({ error: "Detail unggahan tidak valid." }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Foto galeri harus JPG, PNG, atau WebP dengan ukuran maksimal 5 MB." }, { status: 400 });
  if (!await allowRequest(`gallery-upload:user:${userId}`, 40, 60 * 60)) return NextResponse.json({ error: "Batas unggah galeri tercapai. Coba lagi nanti." }, { status: 429 });

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
  const safeName = stripControlCharacters(parsed.data.originalName.split(/[\\/]/).pop() ?? "").slice(0, 255) || "foto-galeri";
  const storageKey = `originals/${invitation.organizationId}/${invitation.id}/${assetId}/gallery-source.${extensions[parsed.data.contentType]}`;
  const uploadUrl = await getSignedUrl(getR2Client(), new PutObjectCommand({ Bucket: config.privateBucket, Key: storageKey, ContentType: parsed.data.contentType, ContentLength: parsed.data.sizeBytes }), { expiresIn: 300 });
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
      metadata: { mediaKind: "gallery" },
    },
  });
  return NextResponse.json({ assetId, uploadUrl, expiresIn: 300 }, { status: 201 });
}
