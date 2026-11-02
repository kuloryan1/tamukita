import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvitationPreview } from "@/components/invitation-preview";
import { PublicInvitation } from "@/components/public-invitation";
import { ReferenceInvitation } from "@/components/reference-invitation";
import { createDemoDraft } from "@/lib/invitations";
import { getReferenceTemplatePreset } from "@/lib/reference-template-presets";
import { getPublishedTemplateCatalog } from "@/lib/template-catalog";

export const dynamic = "force-dynamic";

type TemplateDemoPageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ design?: string | string[] }> };

export async function generateMetadata({ params }: TemplateDemoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const template = (await getPublishedTemplateCatalog()).find((candidate) => candidate.slug === slug);
  return {
    title: template ? `Demo ${template.name}` : "Demo template",
    description: template ? `Lihat undangan contoh dengan template ${template.name}.` : "Lihat demo template undangan TamuKita.",
  };
}

export default async function TemplateDemoPage({ params, searchParams }: TemplateDemoPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const design = Array.isArray(query.design) ? query.design[0] : query.design;
  const template = (await getPublishedTemplateCatalog()).find((candidate) => candidate.slug === slug);
  if (!template) notFound();

  const demoPath = `/templates/${encodeURIComponent(template.slug)}/demo`;
  const draft = {
    ...createDemoDraft(),
    slug: `demo-${template.slug}`,
    templateId: template.slug,
    templateVersion: template.version,
    eventDate: "2026-11-21",
    eventTime: "18:00",
    venue: "Gedung Pariwisata Surabaya",
    address: "Surabaya, Jawa Timur",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Gedung+Pariwisata+Surabaya",
    story: "Dengan penuh syukur, kami mengundang Anda untuk merayakan hari istimewa ini bersama.",
  };

  const referencePreset = design === "reference" ? getReferenceTemplatePreset(template.slug) : undefined;
  if (referencePreset) {
    return <ReferenceInvitation
      slug={draft.slug}
      initialDraft={draft}
      preset={referencePreset}
      initialRsvpCount={0}
      isExample
      sharePath={`${demoPath}?design=reference`}
    />;
  }

  return <PublicInvitation
    slug={draft.slug}
    initialDraft={draft}
    initialRsvpCount={0}
    isExample
    templateSlug={template.slug}
    sharePath={demoPath}
    preview={<InvitationPreview draft={draft} full mode="public" template={template} />}
  />;
}
