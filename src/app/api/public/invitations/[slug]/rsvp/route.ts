import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allowRequest, getRequestAddress } from "@/lib/rate-limit";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const rsvpSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  guestToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
  attendance: z.enum(["ATTENDING", "DECLINED"]),
  attendeeCount: z.number().int().min(1).max(10).default(1),
}).refine((value) => value.guestToken || value.name, { message: "Nama tamu diperlukan." });

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await readJsonBody(request, 16_000);
  if (!body.ok) return NextResponse.json({ error: "Isi RSVP tidak valid." }, { status: body.status });
  const parsed = rsvpSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Isi nama dan pilihan kehadiran dengan benar." }, { status: 400 });
  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], organization: { status: "ACTIVE" } },
    select: { id: true, title: true, owner: { select: { name: true, email: true } } },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan atau belum diterbitkan." }, { status: 404 });

  let guestId: string | null = null;
  let displayName = parsed.data.name ?? "";
  if (parsed.data.guestToken) {
    const guestLink = await prisma.guestLink.findFirst({
      where: { invitationId: invitation.id, tokenHash: createHash("sha256").update(parsed.data.guestToken).digest("hex") },
      select: { guestId: true, guest: { select: { name: true } } },
    });
    if (!guestLink) return NextResponse.json({ error: "Tautan tamu ini tidak valid." }, { status: 403 });
    guestId = guestLink.guestId;
    displayName = guestLink.guest.name;
  }

  const address = getRequestAddress(request);
  const ipAllowed = await allowRequest(`rsvp:ip:${address}`, 10, 60 * 60);
  const invitationAllowed = await allowRequest(`rsvp:invitation:${invitation.id}:${address}`, 5, 60 * 60);
  if (!ipAllowed || !invitationAllowed) {
    return NextResponse.json({ error: "Terlalu banyak RSVP dari perangkat ini. Coba lagi nanti." }, { status: 429 });
  }

  const ownerEmail = invitation.owner.email;
  await prisma.$transaction(async (tx) => {
    let rsvpId: string;
    const respondedAt = new Date();
    if (guestId) {
      const previous = await tx.rSVP.findFirst({ where: { invitationId: invitation.id, guestId }, select: { id: true } });
      if (previous) {
        await tx.rSVP.update({ where: { id: previous.id }, data: { displayName, attendance: parsed.data.attendance, attendeeCount: parsed.data.attendeeCount, respondedAt } });
        rsvpId = previous.id;
      } else {
        const created = await tx.rSVP.create({
          data: { invitationId: invitation.id, guestId, displayName, attendance: parsed.data.attendance, attendeeCount: parsed.data.attendeeCount, respondedAt },
          select: { id: true },
        });
        rsvpId = created.id;
      }
    } else {
      const created = await tx.rSVP.create({
        data: { invitationId: invitation.id, displayName, attendance: parsed.data.attendance, attendeeCount: parsed.data.attendeeCount, respondedAt },
        select: { id: true },
      });
      rsvpId = created.id;
    }

    if (ownerEmail) {
      const jobKey = `rsvp-confirmation:${rsvpId}:${randomUUID()}`;
      await tx.notificationJob.create({
        data: {
          jobKey,
          jobType: "RSVP_RECEIVED_EMAIL",
          payload: {
            to: ownerEmail,
            ownerName: invitation.owner.name ?? "",
            invitationId: invitation.id,
            invitationTitle: invitation.title,
            guestName: displayName,
            attendance: parsed.data.attendance,
            attendeeCount: parsed.data.attendeeCount,
          },
        },
      });
    }
  });
  return NextResponse.json({ saved: true }, { status: 201 });
}
