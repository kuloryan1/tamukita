import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const guestSchema = z.object({ names: z.array(z.string().trim().min(2).max(100)).min(1).max(100) });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID undangan tidak valid." }, { status: 400 });
  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: { id, ownerId: userId, deletedAt: null, organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } },
    select: { id: true },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan atau aksesnya sudah tidak tersedia." }, { status: 404 });
  const links = await prisma.guestLink.findMany({
    where: { invitationId: invitation.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      guest: {
        select: {
          id: true,
          name: true,
          rsvps: { where: { invitationId: invitation.id }, orderBy: { respondedAt: "desc" }, take: 1, select: { attendance: true, attendeeCount: true, respondedAt: true } },
        },
      },
    },
  });
  return NextResponse.json({ guests: links.map(({ guest }) => ({ id: guest.id, name: guest.name, rsvp: guest.rsvps[0] ? { ...guest.rsvps[0], respondedAt: guest.rsvps[0].respondedAt.toISOString() } : null })) });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID undangan tidak valid." }, { status: 400 });
  const body = await readJsonBody(request, 32_000);
  if (!body.ok) return NextResponse.json({ error: "Daftar tamu tidak valid atau terlalu besar." }, { status: body.status });
  const parsed = guestSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Tambahkan nama tamu yang valid (maksimal 100 nama sekali impor)." }, { status: 400 });
  const uniqueNames = new Set(parsed.data.names.map((name) => name.toLocaleLowerCase("id-ID")));
  if (uniqueNames.size !== parsed.data.names.length) return NextResponse.json({ error: "Hapus nama yang duplikat dari daftar ini." }, { status: 400 });
  if (!await allowRequest(`guests:create:user:${userId}`, 30, 60 * 60)) return NextResponse.json({ error: "Batas impor tamu tercapai. Coba lagi nanti." }, { status: 429 });

  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: { id, ownerId: userId, deletedAt: null, status: { in: ["DRAFT", "PUBLISHED"] }, organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } },
    select: { id: true, organizationId: true, slug: true },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan atau aksesnya sudah tidak tersedia." }, { status: 404 });

  const created = await prisma.$transaction(async (tx) => {
    const records: Array<{ id: string; name: string; token: string }> = [];
    for (const name of parsed.data.names) {
      const token = randomBytes(32).toString("base64url");
      const guest = await tx.guest.create({
        data: {
          organizationId: invitation.organizationId,
          name,
          links: { create: { invitation: { connect: { id: invitation.id } }, tokenHash: createHash("sha256").update(token).digest("hex") } },
        },
        select: { id: true, name: true },
      });
      records.push({ ...guest, token });
    }
    await tx.auditLog.create({ data: { organizationId: invitation.organizationId, actorId: userId, action: "guests.imported", targetType: "Invitation", targetId: invitation.id, metadata: { count: records.length } } });
    return records;
  });
  return NextResponse.json({ guests: created, slug: invitation.slug }, { status: 201 });
}
