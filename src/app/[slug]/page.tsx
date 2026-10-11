import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PublicInvitation } from "@/components/public-invitation";
import { createInitialDraft, reservedSlugs } from "@/lib/invitations";
import { parseInvitationDraft } from "@/lib/invitation-server";
import { getPrismaClient } from "@/lib/prisma";
import { getTemplate } from "@/lib/templates";
import { isEditorCompatibleTemplate, validateTemplateManifest } from "@/lib/template-sdk";
import { getInvitationFeatureAccess } from "@/lib/invitation-entitlements";

type PageProps = { params: Promise<{ slug: string }> };
type InvitationPageProps = PageProps & { searchParams: Promise<Record<string, string | string[] | undefined>> };

function invitationMetadata(slug: string, title: string, description: string): Metadata {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL || "https://tamukita.io";
  const baseUrl = new URL(configuredUrl).origin;
  const pageUrl = new URL(`/${encodeURIComponent(slug)}`, baseUrl).toString();
  const imageUrl = new URL(`/${encodeURIComponent(slug)}/opengraph-image`, baseUrl).toString();
  const image = { url: imageUrl, width: 1200, height: 630, alt: `Pratinjau ${title}` };
  return {
    metadataBase: new URL(baseUrl),
    title: `Undangan ${title}`,
    description,
    alternates: { canonical: pageUrl },
    openGraph: { title: `Undangan ${title}`, description, url: pageUrl, siteName: "TamuKita", locale: "id_ID", type: "website", images: [image] },
    twitter: { card: "summary_large_image", title: `Undangan ${title}`, description, images: [imageUrl] },
  };
}

const findPublished = cache(async (slug: string) => {
  const invitation = await getPrismaClient().invitation.findFirst({
    where: { slug, status: "PUBLISHED", deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], organization: { status: "ACTIVE" } },
    select: {
      id: true,
      organizationId: true,
      title: true,
      publishedSnapshot: true,
      templateVersion: { select: { version: true, manifest: true, template: { select: { slug: true } } } },
      _count: { select: { rsvps: true } },
    },
  });
  if (!invitation) return null;
  const draft = parseInvitationDraft(invitation.publishedSnapshot);
  const manifest = validateTemplateManifest(invitation.templateVersion.manifest);
  const template = manifest.success
    && manifest.data.slug === invitation.templateVersion.template.slug
    && manifest.data.version === invitation.templateVersion.version
    && isEditorCompatibleTemplate(manifest.data)
    ? manifest.data
    : getTemplate(invitation.templateVersion.template.slug);
  if (draft && draft.templateId !== invitation.templateVersion.template.slug) return null;
  const featureAccess = await getInvitationFeatureAccess(invitation.id);
  return { ...invitation, draft, template, featureAccess };
});

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const record = await findPublished(slug);
  if (record) return invitationMetadata(slug, record.title, record.draft?.story || "Undangan digital yang dibuat dengan TamuKita.");
  if (slug === "nara-dimas") return invitationMetadata(slug, "Pernikahan Nara & Dimas", "Contoh undangan digital TamuKita.");
  return { title: "Undangan tidak tersedia", description: "Undangan digital yang dibuat dengan TamuKita.", robots: { index: false, follow: false } };
}

export default async function InvitationPage({ params, searchParams }: InvitationPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  if (reservedSlugs.has(slug.toLowerCase())) notFound();
  const record = await findPublished(slug);
  if (!record?.draft || !record.template) {
    if (slug === "nara-dimas") {
      return <PublicInvitation slug={slug} initialDraft={{ ...createInitialDraft(), slug, publishedAt: "2026-01-01T00:00:00.000Z" }} initialRsvpCount={0} isExample />;
    }
    notFound();
  }

  const candidateToken = typeof query.g === "string" && /^[A-Za-z0-9_-]{43}$/.test(query.g) ? query.g : null;
  const guestLink = candidateToken ? await getPrismaClient().guestLink.findFirst({
    where: { invitationId: record.id, tokenHash: createHash("sha256").update(candidateToken).digest("hex") },
    select: { guest: { select: { name: true } } },
  }) : null;

  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const prisma = getPrismaClient();
  after(async () => {
    try {
      await prisma.analyticsDaily.upsert({
        where: { organizationId_date_metricKey: { organizationId: record.organizationId, date, metricKey: "invitation_views" } },
        create: { organizationId: record.organizationId, date, metricKey: "invitation_views", metricValue: BigInt(1), dimensions: { invitationId: record.id } },
        update: { metricValue: { increment: BigInt(1) } },
      });
    } catch {
      console.error("Failed to record public invitation view analytics.");
    }
  });
  const guestbook = await prisma.guestbookEntry.findMany({
    where: { invitationId: record.id, status: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: { id: true, displayName: true, message: true, createdAt: true },
  });
  return <PublicInvitation slug={slug} initialDraft={record.draft} initialRsvpCount={record._count.rsvps} initialGuestbook={guestbook.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() }))} recipientName={guestLink?.guest.name} guestToken={guestLink ? candidateToken ?? undefined : undefined} template={record.template} featureAccess={record.featureAccess} />;
}
