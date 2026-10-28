import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { canReviewContentReports } from "@/lib/admin-content-reports";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const reviewSchema = z.object({ action: z.enum(["dismiss", "hide", "restore"]) });
const conflict = Symbol("moderation-conflict");

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
  let result: "updated" | "not-found" | "conflict-result";
  try {
    result = await prisma.$transaction(async (tx) => {
      const report = await tx.invitationReport.findUnique({
        where: { id },
        select: {
          id: true,
          reason: true,
          status: true,
          invitation: {
            select: { id: true, status: true, organizationId: true, deletedAt: true, expiresAt: true, publishedSnapshot: true },
          },
        },
      });
      if (!report) return "not-found";

      if (parsed.data.action === "dismiss") {
        const changed = await tx.invitationReport.updateMany({
          where: { id: report.id, status: "PENDING" },
          data: { status: "DISMISSED", reviewedAt },
        });
        if (changed.count !== 1) return "conflict-result";
      } else if (parsed.data.action === "hide") {
        const now = reviewedAt;
        if (report.status !== "PENDING" || report.invitation.status !== "PUBLISHED" || report.invitation.deletedAt || !report.invitation.publishedSnapshot || (report.invitation.expiresAt && report.invitation.expiresAt <= now)) {
          return "conflict-result";
        }
        const changedReports = await tx.invitationReport.updateMany({
          where: { invitationId: report.invitation.id, status: "PENDING" },
          data: { status: "HIDDEN", reviewedAt },
        });
        if (changedReports.count === 0) return "conflict-result";
        const changedInvitation = await tx.invitation.updateMany({
          where: {
            id: report.invitation.id,
            status: "PUBLISHED",
            deletedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          data: { status: "SUSPENDED" },
        });
        if (changedInvitation.count !== 1) throw conflict;
      } else {
        if (report.status !== "HIDDEN" || report.invitation.status !== "SUSPENDED" || report.invitation.deletedAt || !report.invitation.publishedSnapshot || (report.invitation.expiresAt && report.invitation.expiresAt <= reviewedAt)) {
          return "conflict-result";
        }
        const changedInvitation = await tx.invitation.updateMany({
          where: {
            id: report.invitation.id,
            status: "SUSPENDED",
            deletedAt: null,
            OR: [{ expiresAt: null }, { expiresAt: { gt: reviewedAt } }],
          },
          data: { status: "PUBLISHED" },
        });
        if (changedInvitation.count !== 1) return "conflict-result";
        const changedReports = await tx.invitationReport.updateMany({
          where: { invitationId: report.invitation.id, status: "HIDDEN" },
          data: { status: "RESTORED", reviewedAt },
        });
        if (changedReports.count === 0) throw conflict;
      }

      const action = parsed.data.action === "dismiss"
        ? "admin.invitation_report.dismissed"
        : parsed.data.action === "hide"
          ? "admin.invitation_report.hidden"
          : "admin.invitation_report.restored";
      await tx.auditLog.create({
        data: {
          organizationId: report.invitation.organizationId,
          actorId: userId,
          action,
          targetType: "Invitation",
          targetId: report.invitation.id,
          metadata: { reportId: report.id, reason: report.reason, action: parsed.data.action },
        },
      });
      return "updated";
    });
  } catch (error) {
    if (error === conflict) result = "conflict-result";
    else throw error;
  }

  if (result === "not-found") return NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 });
  if (result === "conflict-result") return NextResponse.json({ error: "Laporan atau undangan sudah berubah. Muat ulang antrean." }, { status: 409 });
  return NextResponse.json({ updated: true });
}
