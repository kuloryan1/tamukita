import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { ensureTemplateVersion, eventStartsAt, invitationDraftSchema, invitationTitle, ownsInvitationCoverPhoto, ownsInvitationGalleryPhotos, ownsInvitationMusic } from "@/lib/invitation-server";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";
import { validateInvitationDraft } from "@/lib/validation";
import { getInvitationFeatureAccess } from "@/lib/invitation-entitlements";
import { validateDraftFeatureAccess } from "@/lib/invitation-features";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID draft tidak valid." }, { status: 400 });
  const body = await readJsonBody(request);
  if (!body.ok) return NextResponse.json({ error: "Isi draft tidak valid atau terlalu besar." }, { status: body.status });
  const parsed = invitationDraftSchema.omit({ id: true, updatedAt: true, publishedAt: true, isPublished: true, qaFixture: true }).safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Detail draft undangan tidak valid." }, { status: 400 });

  const prisma = getPrismaClient();
  const existing = await prisma.invitation.findFirst({
    where: { id, ownerId: userId, deletedAt: null, status: { in: ["DRAFT", "PUBLISHED"] }, organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } },
    select: { slug: true, status: true, draftData: true },
  });
  if (!existing) return NextResponse.json({ error: "Draft tidak ditemukan atau aksesnya sudah tidak tersedia." }, { status: 404 });
  const featureAccess = await getInvitationFeatureAccess(id);
  const featureError = validateDraftFeatureAccess(parsed.data, featureAccess);
  if (featureError) return NextResponse.json({ error: featureError }, { status: 403 });
  const template = await ensureTemplateVersion(parsed.data.templateId);
  if (!template) return NextResponse.json({ error: "Template tidak tersedia." }, { status: 400 });
  const legacyCover = typeof existing.draftData === "object" && existing.draftData !== null && !Array.isArray(existing.draftData)
    ? (existing.draftData as Record<string, unknown>).coverPhoto
    : undefined;
  if (parsed.data.coverPhoto.startsWith("data:image/") && parsed.data.coverPhoto !== legacyCover) {
    return NextResponse.json({ error: "Gunakan pengunggah foto untuk menambahkan foto sampul." }, { status: 400 });
  }
  if (parsed.data.coverPhoto.startsWith("https://") && !await ownsInvitationCoverPhoto(userId, id, parsed.data.coverPhoto)) {
    return NextResponse.json({ error: "Foto sampul tidak dimiliki draft ini." }, { status: 400 });
  }
  if (!await ownsInvitationGalleryPhotos(userId, id, parsed.data.galleryPhotos)) {
    return NextResponse.json({ error: "Satu atau beberapa foto galeri tidak dimiliki draft ini." }, { status: 400 });
  }
  if (!await ownsInvitationMusic(userId, id, parsed.data.musicUrl)) {
    return NextResponse.json({ error: "Audio latar tidak dimiliki draft ini." }, { status: 400 });
  }
  const draft = { ...parsed.data, id, slug: existing.status === "PUBLISHED" ? existing.slug : parsed.data.slug, isPublished: existing.status === "PUBLISHED", updatedAt: new Date().toISOString() };
  const formIsComplete = validateInvitationDraft(draft).valid;
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const record = await tx.invitation.updateMany({
        where: {
          id,
          ownerId: userId,
          status: { in: ["DRAFT", "PUBLISHED"] },
          deletedAt: null,
          organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } },
        },
        data: {
          ...(existing.status === "DRAFT" ? {
            slug: draft.slug,
            title: invitationTitle(draft),
            templateVersionId: template.version.id,
            startsAt: eventStartsAt(draft),
          } : {}),
          draftData: JSON.parse(JSON.stringify(draft)),
        },
      });
      if (record.count === 0) return false;
      if (existing.status === "PUBLISHED") return true;
      const event = await tx.event.findFirst({ where: { invitationId: id }, select: { id: true } });
      if (event) {
        await tx.event.update({ where: { id: event.id }, data: { title: invitationTitle(draft), startsAt: eventStartsAt(draft), venue: draft.venue, address: draft.address, mapsUrl: draft.mapsUrl || null } });
      } else {
        await tx.event.create({ data: { invitationId: id, title: invitationTitle(draft), startsAt: eventStartsAt(draft), venue: draft.venue, address: draft.address, mapsUrl: draft.mapsUrl || null } });
      }
      if (existing.status === "DRAFT" && formIsComplete) {
        await tx.invitation.updateMany({ where: { id, status: "DRAFT", formCompletedAt: null }, data: { formCompletedAt: new Date() } });
      }
      return true;
    });
    if (!updated) return NextResponse.json({ error: "Draft tidak ditemukan atau aksesnya sudah tidak tersedia." }, { status: 404 });
    return NextResponse.json({ saved: true, updatedAt: draft.updatedAt });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Tautan undangan ini sudah dipakai. Pilih nama tautan lain." }, { status: 409 });
    }
    throw error;
  }
}
