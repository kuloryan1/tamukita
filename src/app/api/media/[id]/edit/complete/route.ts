import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { getR2Client, getR2Config, r2KeyFromPublicUrl } from "@/lib/r2";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const completeSchema = z.object({
  revisionKey: z.string().uuid(),
  baseRevision: z.number().int().min(0).max(1_000_000),
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

function jobStatus(job: { completedAt: Date | null; failedAt: Date | null; payload: unknown }) {
  const payload = isRecord(job.payload) ? job.payload : {};
  if (job.completedAt && typeof payload.publicUrl === "string" && typeof payload.revision === "number") {
    return NextResponse.json({ status: "READY", publicUrl: payload.publicUrl, revision: payload.revision }, { headers: { "Cache-Control": "private, no-store" } });
  }
  if (job.failedAt) return NextResponse.json({ status: "FAILED", error: "Edit foto gagal diproses atau fotonya berubah di sesi lain. Muat ulang editor lalu coba lagi." }, { headers: { "Cache-Control": "private, no-store" } });
  return NextResponse.json({ status: "PROCESSING" }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID media tidak valid." }, { status: 400 });
  const revisionKey = new URL(request.url).searchParams.get("revisionKey") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(revisionKey)) return NextResponse.json({ error: "Revisi foto tidak valid." }, { status: 400 });
  if (!await allowRequest(`media:cover-edit:status:user:${userId}`, 240, 60 * 60)) return NextResponse.json({ error: "Batas pemeriksaan status edit tercapai." }, { status: 429 });

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
    select: { id: true },
  });
  if (!asset) return NextResponse.json({ error: "Media tidak ditemukan." }, { status: 404 });
  const job = await prisma.notificationJob.findUnique({ where: { jobKey: `media-edit:${asset.id}:${revisionKey}` }, select: { completedAt: true, failedAt: true, payload: true } });
  if (!job) return NextResponse.json({ error: "Revisi edit tidak ditemukan." }, { status: 404 });
  return jobStatus(job);
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
  if (!body.ok) return NextResponse.json({ error: "Detail hasil edit tidak valid." }, { status: body.status });
  const parsed = completeSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pengaturan crop foto tidak valid." }, { status: 400 });
  if (!await allowRequest(`media:cover-edit:complete:user:${userId}`, 30, 60 * 60)) return NextResponse.json({ error: "Batas pemrosesan foto tercapai. Coba lagi nanti." }, { status: 429 });

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
      metadata: true,
      invitation: { select: { draftData: true } },
      edits: { orderBy: { revision: "desc" }, take: 1, select: { revision: true } },
      variants: { where: { variantKey: "cover" }, select: { storageKey: true } },
    },
  });
  const draftData = isRecord(asset?.invitation?.draftData) ? asset.invitation.draftData : null;
  const activeCoverKey = r2KeyFromPublicUrl(typeof draftData?.coverPhoto === "string" ? draftData.coverPhoto : "");
  const revisionKey = parsed.data.revisionKey;
  if (!asset?.invitationId || !activeCoverKey || !asset.variants.some((variant) => variant.storageKey === activeCoverKey)) {
    return NextResponse.json({ error: "Foto sampul tidak ditemukan atau sudah diganti." }, { status: 404 });
  }
  const jobKey = `media-edit:${asset.id}:${revisionKey}`;
  const existingJob = await prisma.notificationJob.findUnique({ where: { jobKey }, select: { completedAt: true, failedAt: true, payload: true } });
  if (existingJob) return jobStatus(existingJob);
  const latestRevision = asset.edits[0]?.revision ?? 0;
  if (latestRevision !== parsed.data.baseRevision) return NextResponse.json({ error: "Foto baru saja diedit di sesi lain. Muat ulang editor lalu coba lagi." }, { status: 409 });

  const cropKey = `private/pending/${asset.organizationId}/${asset.invitationId}/${asset.id}/edits/${revisionKey}.webp`;
  try {
    const head = await getR2Client().send(new HeadObjectCommand({ Bucket: config.privateBucket, Key: cropKey }));
    if (head.ContentLength !== parsed.data.cropSizeBytes || head.ContentType !== "image/webp") {
      return NextResponse.json({ error: "Ukuran atau format foto tidak sesuai." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Hasil edit belum selesai diunggah. Coba lagi." }, { status: 400 });
  }

  const payload = {
    mediaAssetId: asset.id,
    invitationId: asset.invitationId,
    requestedById: userId,
    revisionKey,
    baseRevision: parsed.data.baseRevision,
    cropSizeBytes: parsed.data.cropSizeBytes,
    cropData: JSON.parse(JSON.stringify(parsed.data.cropData)) as Prisma.InputJsonObject,
    activeCoverKey,
  };
  try {
    await prisma.notificationJob.create({ data: { jobKey, jobType: "MEDIA_EDIT_PROCESSING", payload } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const concurrentJob = await prisma.notificationJob.findUnique({ where: { jobKey }, select: { completedAt: true, failedAt: true, payload: true } });
      if (concurrentJob) return jobStatus(concurrentJob);
    }
    throw error;
  }
  return NextResponse.json({ status: "PROCESSING", revisionKey }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
}
