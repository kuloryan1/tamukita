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
import { getInvitationFeatureAccess } from "@/lib/invitation-entitlements";

export const runtime = "nodejs";

const schema = z.object({
  invitationId: z.string().uuid(),
  originalName: z.string().trim().min(1).max(255),
  contentType: z.literal("audio/mpeg"),
  sizeBytes: z.number().int().positive().max(10_000_000),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const config = getR2Config();
  if (!config) return NextResponse.json({ error: "Cloudflare R2 belum dikonfigurasi di server." }, { status: 503 });
  const body = await readJsonBody(request, 8_000);
  if (!body.ok) return NextResponse.json({ error: "Detail unggahan audio tidak valid." }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih file MP3 dengan ukuran maksimal 10 MB." }, { status: 400 });
  if (!await allowRequest(`music-upload:user:${userId}`, 12, 60 * 60)) return NextResponse.json({ error: "Batas unggah musik tercapai. Coba lagi nanti." }, { status: 429 });

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
  const featureAccess = await getInvitationFeatureAccess(invitation.id);
  if (!featureAccess.music) return NextResponse.json({ error: "Paket ini belum mencakup musik latar." }, { status: 403 });

  const assetId = randomUUID();
  const safeName = stripControlCharacters(parsed.data.originalName.split(/[\\/]/).pop() ?? "").slice(0, 255) || "musik-latar.mp3";
  const storageKey = `originals/${invitation.organizationId}/${invitation.id}/${assetId}/music-source.mp3`;
  const uploadUrl = await getSignedUrl(getR2Client(), new PutObjectCommand({ Bucket: config.privateBucket, Key: storageKey, ContentType: "audio/mpeg", ContentLength: parsed.data.sizeBytes }), { expiresIn: 300 });
  await prisma.mediaAsset.create({
    data: {
      id: assetId,
      organizationId: invitation.organizationId,
      invitationId: invitation.id,
      uploadedById: userId,
      storageKey,
      originalName: safeName,
      mimeType: "audio/mpeg",
      sizeBytes: BigInt(parsed.data.sizeBytes),
      status: "PENDING",
      visibility: "PRIVATE_SOURCE",
      metadata: { mediaKind: "music" },
    },
  });
  return NextResponse.json({ assetId, uploadUrl, expiresIn: 300 }, { status: 201 });
}
