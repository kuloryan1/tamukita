import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { getInvitationFeatureAccess } from "@/lib/invitation-entitlements";
import { defaultGuestWhatsAppMessage, GUEST_MESSAGE_MAX_LENGTH, guestMessageError } from "@/lib/guest-whatsapp-message";

export const runtime = "nodejs";
const settingsSchema = z.strictObject({ messageTemplate: z.string().trim().max(GUEST_MESSAGE_MAX_LENGTH) });
const privateHeaders = { "Cache-Control": "private, no-store" };

function invitationAccess(id: string, userId: string) {
  return {
    id, ownerId: userId, deletedAt: null, status: { in: ["DRAFT", "PUBLISHED"] as ("DRAFT" | "PUBLISHED")[] },
    organization: { status: "ACTIVE" as const, memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] as ("OWNER" | "ADMIN" | "EDITOR")[] } } } },
  };
}

async function accessibleInvitation(params: Promise<{ id: string }>) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }) };
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: NextResponse.json({ error: "ID undangan tidak valid." }, { status: 400 }) };
  const invitation = await getPrismaClient().invitation.findFirst({
    where: invitationAccess(id, userId),
    select: { id: true, organizationId: true, guestMessageTemplate: true, draftData: true },
  });
  if (!invitation) return { error: NextResponse.json({ error: "Undangan tidak ditemukan atau aksesnya sudah tidak tersedia." }, { status: 404 }) };
  if (!(await getInvitationFeatureAccess(id)).rsvp) return { error: NextResponse.json({ error: "Paket undangan ini tidak mengaktifkan pengelolaan tamu." }, { status: 403 }) };
  return { invitation, userId };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await accessibleInvitation(params);
  if (access.error) return access.error;
  const draft = access.invitation.draftData;
  const eventKind = draft && typeof draft === "object" && !Array.isArray(draft) ? draft.eventKind : undefined;
  const defaultTemplate = defaultGuestWhatsAppMessage(eventKind);
  return NextResponse.json({ messageTemplate: access.invitation.guestMessageTemplate ?? defaultTemplate, defaultTemplate }, { headers: privateHeaders });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await accessibleInvitation(params);
  if (access.error) return access.error;
  const body = await readJsonBody(request, 24_000);
  if (!body.ok) return NextResponse.json({ error: "Pesan WhatsApp tidak valid atau terlalu besar." }, { status: body.status });
  const parsed = settingsSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pesan WhatsApp harus berupa teks, maksimal 4.000 karakter." }, { status: 400 });
  const validationError = guestMessageError(parsed.data.messageTemplate);
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 });
  if (!await allowRequest(`guests:message:${access.userId}`, 60, 60 * 60)) return NextResponse.json({ error: "Batas penyimpanan pesan tercapai. Coba lagi nanti." }, { status: 429 });
  const saved = await getPrismaClient().$transaction(async (tx) => {
    const result = await tx.invitation.updateMany({
      where: invitationAccess(access.invitation.id, access.userId),
      data: { guestMessageTemplate: parsed.data.messageTemplate },
    });
    if (result.count !== 1) return false;
    await tx.auditLog.create({ data: {
      organizationId: access.invitation.organizationId, actorId: access.userId,
      action: "guests.whatsapp_message_updated", targetType: "Invitation", targetId: access.invitation.id,
      metadata: { characterCount: parsed.data.messageTemplate.length },
    } });
    return true;
  });
  if (!saved) return NextResponse.json({ error: "Akses undangan berubah. Muat ulang lalu coba lagi." }, { status: 404 });
  return NextResponse.json({ messageTemplate: parsed.data.messageTemplate }, { headers: privateHeaders });
}
