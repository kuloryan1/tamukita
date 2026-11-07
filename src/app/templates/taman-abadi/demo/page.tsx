import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvitationPreview } from "@/components/invitation-preview";
import { PublicInvitation } from "@/components/public-invitation";
import { createDemoDraft, DEMO_COUPLE_NAMES } from "@/lib/invitations";
import { getTemplate } from "@/lib/templates";
import { StationeryInvitation } from "@/components/stationery-invitation";
import { getTemplate as getStationeryTemplate } from "@/lib/stationery-demo";
import { normalizeRecipient } from "@/lib/stationery-recipient";
import { isTemplateListed } from "@/lib/template-visibility";

export function generateMetadata(): Metadata {
  if (!isTemplateListed("taman-abadi")) notFound();
  return {
    title: "Taman Abadi — Contoh Undangan",
    description: "Lihat contoh lengkap undangan Taman Abadi, dari sampul amplop hingga konfirmasi kehadiran.",
  };
}

type TamanAbadiDemoPageProps = {
  searchParams: Promise<{
    hostOne?: string | string[];
    hostTwo?: string | string[];
    design?: string | string[];
    to?: string | string[];
  }>;
};

function demoName(value: string | string[] | undefined, fallback: string) {
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate?.trim().slice(0, 80).trim() || fallback;
}

export default async function TamanAbadiDemoPage({ searchParams }: TamanAbadiDemoPageProps) {
  if (!isTemplateListed("taman-abadi")) notFound();
  const query = await searchParams;
  const template = getTemplate("taman-abadi");
  if (!template) notFound();

  const design = Array.isArray(query.design) ? query.design[0] : query.design;
  const stationeryTemplate = getStationeryTemplate(template.slug);
  if (stationeryTemplate && (!design || design === "stationery") && !query.hostOne && !query.hostTwo) {
    return <StationeryInvitation template={stationeryTemplate} recipient={normalizeRecipient(Array.isArray(query.to) ? query.to[0] : query.to)} />;
  }

  const hostOne = demoName(query.hostOne, DEMO_COUPLE_NAMES.hostOne);
  const hostTwo = demoName(query.hostTwo, DEMO_COUPLE_NAMES.hostTwo);

  const draft = {
    ...createDemoDraft(),
    slug: "taman-abadi-demo",
    templateId: template.slug,
    templateVersion: template.version,
    hostOne,
    hostTwo,
    sealMonogram: `${hostOne[0]}${hostTwo[0]}`.toUpperCase(),
    eventDate: "2026-11-21",
    eventTime: "18:00",
    venue: "Gedung Pariwisata Surabaya",
    address: "Jl. Wisata Menanggal No. 38, Dukuh Menanggal, Kec. Gayungan, Surabaya, Jawa Timur 60234",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Gedung+Pariwisata+Surabaya+Wisata+Menanggal",
    customFields: {
      guestArrivalTime: "",
      ceremonyTime: "18:00",
      mocktailTime: "",
      dinnerTime: "",
      danceTime: "",
      dressCode: "Busana formal bernuansa taman. Sentuhan hijau dedaunan, warna sampanye, atau merah marun akan terasa serasi.",
      giftPreference: "Kehadiran dan doa restu Anda adalah hadiah yang paling berarti bagi kami.",
    },
  };

  return <PublicInvitation
    slug={draft.slug}
    initialDraft={draft}
    initialRsvpCount={0}
    isExample
    templateSlug={template.slug}
    sharePath="/templates/taman-abadi/demo"
    preview={<InvitationPreview draft={draft} full mode="public" template={template} />}
  />;
}
