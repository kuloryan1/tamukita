import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { getInvitationFeatureAccess } from "@/lib/invitation-entitlements";

export const runtime = "nodejs";

const linkActionSchema = z.object({ action: z.enum(["revoke", "rotate"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; guestId: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

  const { id, guestId } = await params;
  if (![id, guestId].every((value) => /^[0-9a-f-]{36}$/i.test(value))) {
    return NextResponse.json({ error: "ID undangan atau tamu tidak valid." }, { status: 400 });
  }
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Permintaan tautan tamu tidak valid." }, { status: body.status });
  const parsed = linkActionSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih pencabutan atau penerbitan ulang tautan." }, { status: 400 });
  if (!await allowRequest(`guests:link:${userId}`, 60, 60 * 60)) {
    return NextResponse.json({ error: "Batas pengelolaan tautan tamu tercapai. Coba lagi nanti." }, { status: 429 });
  }

  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: {
      id,
      ownerId: userId,
      deletedAt: null,
      status: { in: ["DRAFT", "PUBLISHED"] },
      organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } },
    },
    select: { id: true, organizationId: true },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan atau aksesnya sudah tidak tersedia." }, { status: 404 });
  const featureAccess = await getInvitationFeatureAccess(invitation.id);
  if (!featureAccess.rsvp) return NextResponse.json({ error: "Paket undangan ini tidak mengaktifkan RSVP dan pengelolaan tamu." }, { status: 403 });

  const result = await prisma.$transaction(async (tx) => {
    const link = await tx.guestLink.findFirst({ where: { invitationId: invitation.id, guestId }, select: { id: true, revokedAt: true } });
    if (!link) return { status: 404 as const };

    if (parsed.data.action === "revoke") {
      if (link.revokedAt) return { status: 200 as const, revoked: true as const };
      const revokedAt = new Date();
      const updated = await tx.guestLink.updateMany({ where: { id: link.id, revokedAt: null }, data: { revokedAt } });
      if (updated.count !== 1) return { status: 409 as const };
      await tx.auditLog.create({ data: { organizationId: invitation.organizationId, actorId: userId, action: "guest_link.revoked", targetType: "GuestLink", targetId: link.id, metadata: { invitationId: invitation.id, guestId } } });
      return { status: 200 as const, revoked: true as const };
    }

    if (!link.revokedAt) return { status: 409 as const };
    const token = randomBytes(32).toString("base64url");
    const updated = await tx.guestLink.updateMany({
      where: { id: link.id, revokedAt: { not: null } },
      data: { tokenHash: createHash("sha256").update(token).digest("hex"), revokedAt: null },
    });
    if (updated.count !== 1) return { status: 409 as const };
    await tx.auditLog.create({ data: { organizationId: invitation.organizationId, actorId: userId, action: "guest_link.rotated", targetType: "GuestLink", targetId: link.id, metadata: { invitationId: invitation.id, guestId } } });
    return { status: 200 as const, token };
  });

  if (result.status === 404) return NextResponse.json({ error: "Tautan tamu tidak ditemukan." }, { status: 404 });
  if (result.status === 409) return NextResponse.json({ error: "Status tautan berubah. Muat ulang daftar tamu lalu coba lagi." }, { status: 409 });
  if ("token" in result) return NextResponse.json({ token: result.token }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ revoked: true });
}
