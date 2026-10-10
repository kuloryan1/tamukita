import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const reviewSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id, entryId } = await params;
  if (![id, entryId].every((value) => /^[0-9a-f-]{36}$/i.test(value))) return NextResponse.json({ error: "ID buku tamu tidak valid." }, { status: 400 });
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Pilihan moderasi tidak valid." }, { status: body.status });
  const parsed = reviewSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih setujui atau tolak." }, { status: 400 });

  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: {
      id,
      ownerId: userId,
      deletedAt: null,
      organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } },
    },
    select: { id: true, organizationId: true },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan atau aksesnya sudah tidak tersedia." }, { status: 404 });

  const entry = await prisma.guestbookEntry.findFirst({ where: { id: entryId, invitationId: invitation.id }, select: { status: true } });
  if (!entry) return NextResponse.json({ error: "Ucapan tidak ditemukan." }, { status: 404 });
  if (entry.status === "HIDDEN") return NextResponse.json({ error: "Ucapan ini sedang disembunyikan moderator platform." }, { status: 409 });

  const reviewedAt = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.guestbookEntry.updateMany({
      where: { id: entryId, invitationId: invitation.id, status: { not: "HIDDEN" } },
      data: { status: parsed.data.status, reviewedAt },
    });
    if (result.count === 0) return false;
    await tx.auditLog.create({
      data: {
        organizationId: invitation.organizationId,
        actorId: userId,
        action: parsed.data.status === "APPROVED" ? "guestbook.approved" : "guestbook.rejected",
        targetType: "GuestbookEntry",
        targetId: entryId,
      },
    });
    return true;
  });
  if (!updated) return NextResponse.json({ error: "Ucapan sedang dimoderasi oleh platform. Muat ulang daftar ucapan." }, { status: 409 });
  return NextResponse.json({ updated: true, status: parsed.data.status });
}
