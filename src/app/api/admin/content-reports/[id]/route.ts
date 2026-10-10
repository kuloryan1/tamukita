import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { canReviewContentReports } from "@/lib/admin-content-reports";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const reviewSchema = z.object({ action: z.enum(["dismiss", "hide", "restore"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 });

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (!canReviewContentReports(user?.platformRole)) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Pilihan moderasi tidak valid." }, { status: body.status });
  const parsed = reviewSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih tindakan moderasi yang tersedia." }, { status: 400 });

  const reviewedAt = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const report = await tx.contentReport.findUnique({
      where: { id },
      select: {
        id: true,
        reason: true,
        status: true,
        guestbookEntry: {
          select: {
            id: true,
            status: true,
            invitationId: true,
            invitation: { select: { organizationId: true } },
          },
        },
      },
    });
    if (!report) return "not-found" as const;

    let auditAction: string;
    if (parsed.data.action === "dismiss") {
      if (report.status !== "PENDING") return "conflict" as const;
      const changed = await tx.contentReport.updateMany({
        where: { id: report.id, status: "PENDING" },
        data: { status: "DISMISSED", reviewedAt },
      });
      if (changed.count !== 1) return "conflict" as const;
      auditAction = "admin.content_report.dismissed";
    } else if (parsed.data.action === "hide") {
      if (report.status !== "PENDING" || report.guestbookEntry.status !== "APPROVED") return "conflict" as const;
      const changed = await tx.contentReport.updateMany({
        where: { id: report.id, status: "PENDING" },
        data: { status: "HIDDEN", reviewedAt },
      });
      if (changed.count !== 1) return "conflict" as const;
      await tx.guestbookEntry.update({ where: { id: report.guestbookEntry.id }, data: { status: "HIDDEN", reviewedAt } });
      await tx.contentReport.updateMany({
        where: { guestbookEntryId: report.guestbookEntry.id, status: "PENDING" },
        data: { status: "HIDDEN", reviewedAt },
      });
      auditAction = "admin.content_report.hidden";
    } else {
      if (report.status !== "HIDDEN" || report.guestbookEntry.status !== "HIDDEN") return "conflict" as const;
      const changed = await tx.guestbookEntry.updateMany({
        where: { id: report.guestbookEntry.id, status: "HIDDEN" },
        data: { status: "APPROVED", reviewedAt },
      });
      if (changed.count !== 1) return "conflict" as const;
      await tx.contentReport.updateMany({
        where: { guestbookEntryId: report.guestbookEntry.id, status: "HIDDEN" },
        data: { status: "RESTORED", reviewedAt },
      });
      auditAction = "admin.content_report.restored";
    }

    await tx.auditLog.create({
      data: {
        organizationId: report.guestbookEntry.invitation.organizationId,
        actorId: userId,
        action: auditAction,
        targetType: "GuestbookEntry",
        targetId: report.guestbookEntry.id,
        metadata: { reportId: report.id, reason: report.reason, action: parsed.data.action },
      },
    });
    return "updated" as const;
  });

  if (result === "not-found") return NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 });
  if (result === "conflict") return NextResponse.json({ error: "Laporan atau ucapan sudah ditinjau. Muat ulang antrean." }, { status: 409 });
  return NextResponse.json({ updated: true });
}
