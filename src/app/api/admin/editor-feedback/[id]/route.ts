import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { canReviewEditorFeedback } from "@/lib/editor-feedback";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const statusSchema = z.object({ status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 });

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (!canReviewEditorFeedback(user?.platformRole)) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Status laporan tidak valid." }, { status: body.status });
  const parsed = statusSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih status laporan yang tersedia." }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.editorFeedback.findUnique({
      where: { id },
      select: { id: true, status: true, category: true, organizationId: true },
    });
    if (!current) return "not-found" as const;
    if (current.status === parsed.data.status) return "unchanged" as const;

    const updatedAt = new Date();
    const updated = await tx.editorFeedback.updateMany({
      where: { id, status: current.status },
      data: { status: parsed.data.status, updatedAt },
    });
    if (updated.count !== 1) return "conflict" as const;

    await tx.auditLog.create({
      data: {
        organizationId: current.organizationId,
        actorId: userId,
        action: "admin.editor_feedback.status_changed",
        targetType: "EditorFeedback",
        targetId: id,
        metadata: { category: current.category, previousStatus: current.status, status: parsed.data.status },
      },
    });
    return "updated" as const;
  });

  if (result === "not-found") return NextResponse.json({ error: "Laporan tidak ditemukan." }, { status: 404 });
  if (result === "unchanged") return NextResponse.json({ updated: true, unchanged: true });
  if (result === "conflict") return NextResponse.json({ error: "Laporan sudah berubah. Muat ulang antrean." }, { status: 409 });
  return NextResponse.json({ updated: true });
}
