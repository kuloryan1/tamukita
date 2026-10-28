import { NextResponse } from "next/server";
import { z } from "zod";
import { createInvitationReporterFingerprint } from "@/lib/content-reports";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest, getRequestAddress } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const reportSchema = z.object({
  reason: z.enum(["CHILD_SAFETY", "PERSONAL_INFORMATION", "COPYRIGHT", "IMPERSONATION", "SPAM", "OTHER"]),
});

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await readJsonBody(request, 2_000);
  if (!body.ok) return NextResponse.json({ error: "Alasan laporan tidak valid." }, { status: body.status });
  const parsed = reportSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih alasan laporan yang tersedia." }, { status: 400 });

  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: {
      slug,
      status: "PUBLISHED",
      deletedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      organization: { status: "ACTIVE" },
    },
    select: { id: true },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });

  const address = getRequestAddress(request);
  const ipAllowed = await allowRequest(`invitation-report:ip:${address}`, 20, 60 * 60);
  const invitationAllowed = await allowRequest(`invitation-report:target:${invitation.id}:${address}`, 4, 60 * 60);
  if (!ipAllowed || !invitationAllowed) {
    return NextResponse.json({ error: "Terlalu banyak laporan dalam waktu singkat. Coba lagi nanti." }, { status: 429 });
  }

  const reporterFingerprint = createInvitationReporterFingerprint(invitation.id, address);
  await prisma.invitationReport.upsert({
    where: { invitationId_reporterFingerprint: { invitationId: invitation.id, reporterFingerprint } },
    create: { invitationId: invitation.id, reporterFingerprint, reason: parsed.data.reason },
    update: { reason: parsed.data.reason, status: "PENDING", reviewedAt: null },
    select: { id: true },
  });

  return NextResponse.json({ reported: true }, { status: 201 });
}
