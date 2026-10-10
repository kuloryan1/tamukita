import { NextResponse } from "next/server";
import { z } from "zod";
import { allowRequest, getRequestAddress } from "@/lib/rate-limit";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const guestbookSchema = z.object({
  name: z.string().trim().min(2).max(100),
  message: z.string().trim().min(2).max(1000),
});

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await readJsonBody(request, 16_000);
  if (!body.ok) return NextResponse.json({ error: "Isi ucapan tidak valid." }, { status: body.status });
  const parsed = guestbookSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Isi nama dan ucapan dengan benar." }, { status: 400 });

  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], organization: { status: "ACTIVE" } },
    select: { id: true },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan atau belum diterbitkan." }, { status: 404 });

  const address = getRequestAddress(request);
  const ipAllowed = await allowRequest(`guestbook:ip:${address}`, 12, 60 * 60);
  const invitationAllowed = await allowRequest(`guestbook:invitation:${invitation.id}:${address}`, 4, 60 * 60);
  if (!ipAllowed || !invitationAllowed) {
    return NextResponse.json({ error: "Terlalu banyak ucapan dari perangkat ini. Coba lagi nanti." }, { status: 429 });
  }

  await prisma.guestbookEntry.create({
    data: { invitationId: invitation.id, displayName: parsed.data.name, message: parsed.data.message },
    select: { id: true },
  });
  return NextResponse.json({ saved: true, moderated: true }, { status: 201 });
}
