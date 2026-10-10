import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrismaClient } from "@/lib/prisma";
import { createReporterFingerprint } from "@/lib/content-reports";
import { allowRequest, getRequestAddress } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const reportSchema = z.object({
  reason: z.enum(["SPAM", "HARASSMENT", "PERSONAL_INFORMATION", "OTHER"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ slug: string; entryId: string }> }) {
  const { slug, entryId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(entryId)) return NextResponse.json({ error: "Ucapan tidak ditemukan." }, { status: 404 });

  const body = await readJsonBody(request, 2_000);
  if (!body.ok) return NextResponse.json({ error: "Alasan laporan tidak valid." }, { status: body.status });
  const parsed = reportSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih alasan laporan yang tersedia." }, { status: 400 });

  const prisma = getPrismaClient();
  const entry = await prisma.guestbookEntry.findFirst({
    where: {
      id: entryId,
      status: "APPROVED",
      invitation: {
        slug,
        status: "PUBLISHED",
        deletedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        organization: { status: "ACTIVE" },
      },
    },
    select: { id: true, invitationId: true },
  });
  if (!entry) return NextResponse.json({ error: "Ucapan tidak ditemukan." }, { status: 404 });

  const address = getRequestAddress(request);
  const ipAllowed = await allowRequest(`content-report:ip:${address}`, 20, 60 * 60);
  const invitationAllowed = await allowRequest(`content-report:invitation:${entry.invitationId}:${address}`, 8, 60 * 60);
  if (!ipAllowed || !invitationAllowed) {
    return NextResponse.json({ error: "Terlalu banyak laporan dari perangkat ini. Coba lagi nanti." }, { status: 429 });
  }

  const reporterFingerprint = createReporterFingerprint(entry.id, address);
  await prisma.contentReport.upsert({
    where: { guestbookEntryId_reporterFingerprint: { guestbookEntryId: entry.id, reporterFingerprint } },
    create: { guestbookEntryId: entry.id, reporterFingerprint, reason: parsed.data.reason },
    update: { reason: parsed.data.reason, status: "PENDING", reviewedAt: null },
    select: { id: true },
  });

  return NextResponse.json({ reported: true }, { status: 201 });
}
