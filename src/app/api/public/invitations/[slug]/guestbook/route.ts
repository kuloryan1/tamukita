import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { allowRequest, getRequestAddress } from "@/lib/rate-limit";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";
import { childDataConsentRecord, CHILD_DATA_CONSENT_ERROR, guardianConsentMatchesChildData } from "@/lib/child-data-consent";
import { GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_VERSION } from "@/lib/consent-versions";
import { isAdminSampleSnapshot } from "@/lib/invitation-publication";
import { getGuestbookEntryStatus, getGuestbookFilterWordsFromDraft } from "@/lib/guestbook-word-filter";

export const runtime = "nodejs";

const guestbookSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  guestToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/).optional(),
  message: z.string().trim().min(2).max(1000),
  includesChildData: z.boolean().default(false),
  guardianConsent: z.boolean().default(false),
}).refine((value) => value.guestToken || value.name, { message: "Nama tamu diperlukan." })
  .refine((value) => guardianConsentMatchesChildData(value.includesChildData, value.guardianConsent), { message: CHILD_DATA_CONSENT_ERROR });

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await readJsonBody(request, 16_000);
  if (!body.ok) return NextResponse.json({ error: "Isi ucapan tidak valid." }, { status: body.status });
  const parsed = guestbookSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: `Isi nama dan ucapan dengan benar. ${CHILD_DATA_CONSENT_ERROR}` }, { status: 400 });

  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], organization: { status: "ACTIVE" } },
    select: { id: true, draftData: true, publishedSnapshot: true, templateVersion: { select: { template: { select: { slug: true } } } } },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan atau belum diterbitkan." }, { status: 404 });
  const guestbookDraft = isAdminSampleSnapshot(invitation.publishedSnapshot) ? invitation.draftData : invitation.publishedSnapshot;
  const status = getGuestbookEntryStatus(invitation.templateVersion.template.slug, parsed.data.message, getGuestbookFilterWordsFromDraft(guestbookDraft));

  let guestId: string | null = null;
  let displayName = parsed.data.name ?? "";
  if (parsed.data.guestToken) {
    const link = await getPrismaClient().guestLink.findFirst({
      where: { invitationId: invitation.id, tokenHash: createHash("sha256").update(parsed.data.guestToken).digest("hex"), revokedAt: null },
      select: { guestId: true, guest: { select: { name: true } } },
    });
    if (!link) return NextResponse.json({ error: "Tautan tamu ini tidak valid." }, { status: 403 });
    guestId = link.guestId;
    displayName = link.guest.name;
  }

  const address = getRequestAddress(request);
  const ipAllowed = await allowRequest(`guestbook:ip:${address}`, 12, 60 * 60);
  const invitationAllowed = await allowRequest(`guestbook:invitation:${invitation.id}:${address}`, 4, 60 * 60);
  if (!ipAllowed || !invitationAllowed) {
    return NextResponse.json({ error: "Terlalu banyak ucapan dari perangkat ini. Coba lagi nanti." }, { status: 429 });
  }

  await prisma.guestbookEntry.create({
    data: { invitationId: invitation.id, guestId, displayName, message: parsed.data.message, status, ...childDataConsentRecord(parsed.data.includesChildData, GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_VERSION) },
    select: { id: true },
  });
  return NextResponse.json({ saved: true, status }, { status: 201 });
}
