import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { getR2Client, getR2Config, r2KeyFromPublicUrl } from "@/lib/r2";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const editSchema = z.object({
  baseRevision: z.number().int().min(0).max(1_000_000),
  cropContentType: z.literal("image/webp"),
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID media tidak valid." }, { status: 400 });
  const config = getR2Config();
  if (!config) return NextResponse.json({ error: "Cloudflare R2 belum dikonfigurasi di server." }, { status: 503 });
  const body = await readJsonBody(request, 12_000);
  if (!body.ok) return NextResponse.json({ error: "Detail edit foto tidak valid." }, { status: body.status });
  const parsed = editSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pengaturan crop foto tidak valid." }, { status: 400 });
  if (!await allowRequest(`media:cover-edit:write:user:${userId}`, 30, 60 * 60)) return NextResponse.json({ error: "Batas edit foto tercapai. Coba lagi nanti." }, { status: 429 });

  const prisma = getPrismaClient();
  const asset = await prisma.mediaAsset.findFirst({
    where: {
      id,
      uploadedById: userId,
      status: "READY",
      deletedAt: null,
      invitation: {
        ownerId: userId,
        deletedAt: null,
        status: { in: ["DRAFT", "PUBLISHED"] },
        organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } },
      },
    },
    select: {
      id: true,
      organizationId: true,
      invitationId: true,
      invitation: { select: { draftData: true } },
      edits: { orderBy: { revision: "desc" }, take: 1, select: { revision: true } },
      variants: { where: { variantKey: "cover" }, select: { storageKey: true } },
    },
  });
  const draftData = isRecord(asset?.invitation?.draftData) ? asset.invitation.draftData : null;
  const activeCoverKey = r2KeyFromPublicUrl(typeof draftData?.coverPhoto === "string" ? draftData.coverPhoto : "");
  if (!asset || !activeCoverKey || !asset.variants.some((variant) => variant.storageKey === activeCoverKey)) {
    return NextResponse.json({ error: "Foto sampul tidak ditemukan atau sudah diganti." }, { status: 404 });
  }
  if ((asset.edits[0]?.revision ?? 0) !== parsed.data.baseRevision) {
    return NextResponse.json({ error: "Foto baru saja diedit di sesi lain. Muat ulang editor lalu coba lagi." }, { status: 409 });
  }

  const revisionKey = randomUUID();
  const cropKey = `private/pending/${asset.organizationId}/${asset.invitationId}/${asset.id}/edits/${revisionKey}.webp`;
  const uploadUrl = await getSignedUrl(
    getR2Client(),
    new PutObjectCommand({ Bucket: config.privateBucket, Key: cropKey, ContentType: parsed.data.cropContentType, ContentLength: parsed.data.cropSizeBytes }),
    { expiresIn: 300 },
  );
  return NextResponse.json({ uploadUrl, revisionKey, baseRevision: parsed.data.baseRevision, cropData: parsed.data.cropData, cropSizeBytes: parsed.data.cropSizeBytes }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}
