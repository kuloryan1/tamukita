import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { getInvitationFeatureAccess } from "@/lib/invitation-entitlements";
import { decryptGuestPhone, encryptGuestPhone } from "@/lib/guest-contact-crypto";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-link";

export const runtime = "nodejs";

const guestInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  whatsapp: z.string().trim().max(300).optional().default(""),
});
const guestSchema = z.object({
  names: z.array(z.string().trim().min(2).max(100)).min(1).max(100).optional(),
  guests: z.array(guestInputSchema).min(1).max(100).optional(),
}).refine((value) => Boolean(value.names?.length || value.guests?.length));

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
  const featureAccess = await getInvitationFeatureAccess(invitation.id);
  if (!featureAccess.rsvp) return NextResponse.json({ error: "Paket undangan ini tidak mengaktifkan konfirmasi kehadiran dan pengelolaan tamu." }, { status: 403 });
  const links = await prisma.guestLink.findMany({
    where: { invitationId: invitation.id },
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      guest: {
        select: {
          id: true,
          name: true,
          phoneCiphertext: true,
          rsvps: { where: { invitationId: invitation.id }, orderBy: { respondedAt: "desc" }, take: 1, select: { attendance: true, attendeeCount: true, respondedAt: true } },
        },
      },
    },
  });
  return NextResponse.json({ guests: links.map(({ guest, revokedAt }) => ({
    id: guest.id,
    name: guest.name,
    whatsapp: guest.phoneCiphertext ? (() => { try { return decryptGuestPhone(guest.phoneCiphertext); } catch { return null; } })() : null,
    linkRevokedAt: revokedAt?.toISOString() ?? null,
    rsvp: guest.rsvps[0] ? { ...guest.rsvps[0], respondedAt: guest.rsvps[0].respondedAt.toISOString() } : null,
  })) }, { headers: { "Cache-Control": "private, no-store" } });
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
  if (!parsed.success) return NextResponse.json({ error: "Tambahkan nama tamu yang valid (maksimal 100 nama sekali simpan)." }, { status: 400 });
  const recipients = parsed.data.guests ?? parsed.data.names?.map((name) => ({ name, whatsapp: "" })) ?? [];
  const normalizedRecipients = recipients.map((recipient) => ({
    name: recipient.name,
    whatsapp: recipient.whatsapp ? normalizeWhatsAppPhone(recipient.whatsapp) : null,
    hasWhatsAppInput: Boolean(recipient.whatsapp),
  }));
  if (normalizedRecipients.some((recipient) => recipient.hasWhatsAppInput && !recipient.whatsapp)) {
    return NextResponse.json({ error: "Tautan WhatsApp tidak valid. Gunakan nomor dengan kode negara, misalnya 628123456789, atau tautan wa.me." }, { status: 400 });
  }
  const uniqueNames = new Set(normalizedRecipients.map(({ name }) => name.toLocaleLowerCase("id-ID")));
  if (uniqueNames.size !== normalizedRecipients.length) return NextResponse.json({ error: "Hapus nama yang duplikat dari daftar ini." }, { status: 400 });
  if (!await allowRequest(`guests:create:user:${userId}`, 30, 60 * 60)) return NextResponse.json({ error: "Batas impor tamu tercapai. Coba lagi nanti." }, { status: 429 });

  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: { id, ownerId: userId, deletedAt: null, status: { in: ["DRAFT", "PUBLISHED"] }, organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } },
    select: { id: true, organizationId: true, slug: true },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan atau aksesnya sudah tidak tersedia." }, { status: 404 });
  const featureAccess = await getInvitationFeatureAccess(invitation.id);
  if (!featureAccess.rsvp) return NextResponse.json({ error: "Paket undangan ini tidak mengaktifkan konfirmasi kehadiran dan pengelolaan tamu." }, { status: 403 });

  const created = await prisma.$transaction(async (tx) => {
    const records: Array<{ id: string; name: string; token: string; whatsapp: string | null }> = [];
    for (const recipient of normalizedRecipients) {
      const token = randomBytes(32).toString("base64url");
      const guest = await tx.guest.create({
        data: {
          organizationId: invitation.organizationId,
          name: recipient.name,
          phoneCiphertext: recipient.whatsapp ? encryptGuestPhone(recipient.whatsapp) : null,
          links: { create: { invitation: { connect: { id: invitation.id } }, tokenHash: createHash("sha256").update(token).digest("hex") } },
        },
        select: { id: true, name: true },
      });
      records.push({ ...guest, token, whatsapp: recipient.whatsapp });
    }
    await tx.auditLog.create({ data: { organizationId: invitation.organizationId, actorId: userId, action: "guests.imported", targetType: "Invitation", targetId: invitation.id, metadata: { count: records.length } } });
    return records;
  });
  return NextResponse.json({ guests: created, slug: invitation.slug }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
