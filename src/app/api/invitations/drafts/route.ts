import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { normalizeInvitationCustomFields } from "@/lib/invitations";
import { ensureTemplateVersion, eventStartsAt, getWritableOrganizationId, invitationDraftSchema, invitationTitle } from "@/lib/invitation-server";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";
import { isTemplateSelectable } from "@/lib/template-sdk";
import { normalizeSealMonogram } from "@/lib/seal-monogram";
import { getInvitationFeatureAccess } from "@/lib/invitation-entitlements";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const url = new URL(request.url);
  const requestedId = url.searchParams.get("id");
  if (requestedId && !/^[0-9a-f-]{36}$/i.test(requestedId)) return NextResponse.json({ error: "ID draft tidak valid." }, { status: 400 });
  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: {
      ownerId: userId,
      deletedAt: null,
      status: { in: ["DRAFT", "PUBLISHED"] },
      ...(requestedId ? { id: requestedId } : {}),
      organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } }, } },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true, slug: true, draftData: true, updatedAt: true, status: true },
  });
  if (!invitation) return NextResponse.json({ draft: null });
  const featureAccess = await getInvitationFeatureAccess(invitation.id);
  const draftData = typeof invitation.draftData === "object" && invitation.draftData !== null && !Array.isArray(invitation.draftData)
    ? { ...invitation.draftData, sealMonogram: normalizeSealMonogram(invitation.draftData.sealMonogram), familyDetails: typeof invitation.draftData.familyDetails === "string" ? invitation.draftData.familyDetails : "", coverPositionX: typeof invitation.draftData.coverPositionX === "number" ? invitation.draftData.coverPositionX : 50, galleryPhotos: Array.isArray(invitation.draftData.galleryPhotos) ? invitation.draftData.galleryPhotos : [], giftMessage: typeof invitation.draftData.giftMessage === "string" ? invitation.draftData.giftMessage : "", giftBankName: typeof invitation.draftData.giftBankName === "string" ? invitation.draftData.giftBankName : "", giftAccountName: typeof invitation.draftData.giftAccountName === "string" ? invitation.draftData.giftAccountName : "", giftAccountNumber: typeof invitation.draftData.giftAccountNumber === "string" ? invitation.draftData.giftAccountNumber : "", musicUrl: typeof invitation.draftData.musicUrl === "string" ? invitation.draftData.musicUrl : "", musicTitle: typeof invitation.draftData.musicTitle === "string" ? invitation.draftData.musicTitle : "", customFields: normalizeInvitationCustomFields(invitation.draftData.customFields), id: invitation.id, slug: invitation.slug, updatedAt: invitation.updatedAt.toISOString(), isPublished: invitation.status === "PUBLISHED" }
    : null;
  return NextResponse.json({ draft: draftData, featureAccess });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: "Isi draft tidak valid atau terlalu besar." }, { status: body.status });
  const parsed = invitationDraftSchema.omit({ id: true, updatedAt: true, publishedAt: true, isPublished: true, qaFixture: true }).safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Detail draft undangan tidak valid." }, { status: 400 });
  if (parsed.data.coverPhoto || parsed.data.galleryPhotos.length || parsed.data.musicUrl) return NextResponse.json({ error: "Foto dan musik ditambahkan setelah draft dibuat." }, { status: 400 });
  const organizationId = await getWritableOrganizationId(userId);
  if (!organizationId) return NextResponse.json({ error: "Workspace aktif tidak ditemukan." }, { status: 403 });
  const template = await ensureTemplateVersion(parsed.data.templateId);
  if (!template) return NextResponse.json({ error: "Template tidak tersedia." }, { status: 400 });
  if (!isTemplateSelectable(template.template.status)) return NextResponse.json({ error: "Template ini tidak menerima undangan baru." }, { status: 409 });

  const prisma = getPrismaClient();
  const id = randomUUID();
  const draft = { ...parsed.data, id, slug: `draft-${id.slice(0, 12)}`, updatedAt: new Date().toISOString() };
  const created = await prisma.invitation.create({
    data: {
      id,
      organizationId,
      ownerId: userId,
      createdById: userId,
      templateVersionId: template.version.id,
      slug: draft.slug,
      title: invitationTitle(draft),
      draftData: JSON.parse(JSON.stringify(draft)),
      startsAt: eventStartsAt(draft),
      events: { create: [{ title: invitationTitle(draft), startsAt: eventStartsAt(draft), venue: draft.venue, address: draft.address, mapsUrl: draft.mapsUrl || null }] },
      versions: { create: [{ version: 1, type: "DRAFT", snapshot: JSON.parse(JSON.stringify(draft)), createdById: userId }] },
    },
    select: { id: true, slug: true, draftData: true, updatedAt: true },
  });
  return NextResponse.json({ draft: { ...draft, id: created.id, slug: created.slug, updatedAt: created.updatedAt.toISOString(), isPublished: false } }, { status: 201 });
}
