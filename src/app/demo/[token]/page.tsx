import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvitationPreview } from "@/components/invitation-preview";
import { PublicInvitation } from "@/components/public-invitation";
import { verifyInvitationDemoToken } from "@/lib/invitation-demo";
import { parseInvitationDraft } from "@/lib/invitation-server";
import { getPrismaClient } from "@/lib/prisma";
import { getTemplate } from "@/lib/templates";
import { isEditorCompatibleTemplate, validateTemplateManifest } from "@/lib/template-sdk";

export const dynamic = "force-dynamic";

type InvitationDemoPageProps = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Demo undangan sementara — TamuKita",
    description: "Pratinjau undangan TamuKita yang dibagikan sebagai demo.",
    robots: { index: false, follow: false },
  };
}

async function findDemo(token: string) {
  const verified = verifyInvitationDemoToken(token);
  if (!verified) return null;

  const invitation = await getPrismaClient().invitation.findFirst({
    where: {
      id: verified.invitationId,
      updatedAt: new Date(verified.updatedAt),
      status: "DRAFT",
      deletedAt: null,
      organization: { status: "ACTIVE" },
    },
    select: {
      id: true,
      updatedAt: true,
      draftData: true,
      templateVersion: { select: { version: true, manifest: true, template: { select: { slug: true } } } },
    },
  });
  if (!invitation || invitation.updatedAt.toISOString() !== verified.updatedAt) return null;

  const draft = parseInvitationDraft(invitation.draftData);
  const { template: templateRecord, version, manifest } = invitation.templateVersion;
  if (!draft || draft.id !== invitation.id || draft.templateId !== templateRecord.slug || draft.templateVersion !== version) return null;

  const parsedManifest = validateTemplateManifest(manifest);
  const manifestTemplate = parsedManifest.success
    && parsedManifest.data.slug === templateRecord.slug
    && parsedManifest.data.version === version
    && isEditorCompatibleTemplate(parsedManifest.data)
    ? parsedManifest.data
    : null;
  const template = manifestTemplate ?? getTemplate(templateRecord.slug);
  if (!template || template.version !== version || !isEditorCompatibleTemplate(template)) return null;

  return { draft: { ...draft, slug: "demo", isPublished: false }, template };
}

export default async function InvitationDemoPage({ params }: InvitationDemoPageProps) {
  const { token } = await params;
  const demo = await findDemo(token);
  if (!demo) notFound();

  return <PublicInvitation
    slug="demo"
    initialDraft={demo.draft}
    initialRsvpCount={0}
    isExample
    demoLabel="DEMO"
    templateSlug={demo.template.slug}
    preview={<InvitationPreview draft={demo.draft} full mode="example" template={demo.template} />}
  />;
}
