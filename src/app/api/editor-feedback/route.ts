import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getWritableOrganizationId } from "@/lib/invitation-server";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const feedbackSchema = z.object({
  category: z.enum(["FORM", "AUTOSAVE", "PHOTO", "TEMPLATE", "PREVIEW", "PUBLISH", "OTHER"]),
  message: z.string().trim().min(8).max(1200),
  invitationId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  if (!await allowRequest(`editor-feedback:${userId}`, 5, 60 * 60)) {
    return NextResponse.json({ error: "Terlalu banyak laporan. Coba lagi nanti." }, { status: 429 });
  }

  const body = await readJsonBody(request, 8_000);
  if (!body.ok) return NextResponse.json({ error: "Isi laporan tidak valid atau terlalu besar." }, { status: body.status });
  const parsed = feedbackSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih jenis kendala dan tulis sedikitnya 8 karakter." }, { status: 400 });

  const prisma = getPrismaClient();
  let organizationId: string | null = null;
  if (parsed.data.invitationId) {
    const invitation = await prisma.invitation.findFirst({
      where: {
        id: parsed.data.invitationId,
        ownerId: userId,
        deletedAt: null,
        status: { in: ["DRAFT", "PUBLISHED"] },
        organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } },
      },
      select: { organizationId: true },
    });
    if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan atau aksesnya sudah tidak tersedia." }, { status: 404 });
    organizationId = invitation.organizationId;
  } else {
    organizationId = await getWritableOrganizationId(userId);
    if (!organizationId) return NextResponse.json({ error: "Workspace aktif tidak ditemukan." }, { status: 403 });
  }

  await prisma.editorFeedback.create({
    data: {
      userId,
      organizationId,
      ...(parsed.data.invitationId ? { invitationId: parsed.data.invitationId } : {}),
      category: parsed.data.category,
      message: parsed.data.message,
    },
    select: { id: true },
  });

  return NextResponse.json({ submitted: true }, { status: 201 });
}
