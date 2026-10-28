import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InvitationPreview } from "@/components/invitation-preview";
import { PublicInvitation } from "@/components/public-invitation";
import { createInitialDraft } from "@/lib/invitations";
import { getTemplate } from "@/lib/templates";

export const metadata: Metadata = {
  title: "Taman Abadi — Contoh Undangan",
  description: "Lihat contoh lengkap undangan Taman Abadi, dari sampul amplop hingga RSVP.",
};

export default function TamanAbadiDemoPage() {
  const template = getTemplate("taman-abadi");
  if (!template) notFound();

  const draft = {
    ...createInitialDraft(),
    slug: "taman-abadi-demo",
    templateId: template.slug,
    templateVersion: template.version,
    hostOne: "Nara",
    hostTwo: "Dimas",
    sealMonogram: "NR",
    eventDate: "2027-05-22",
    eventTime: "13:30",
    venue: "The Garden House",
    address: "Jl. Kemang Raya No. 12, Jakarta Selatan",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=The+Garden+House+Jakarta+Selatan",
    customFields: {
      guestArrivalTime: "12:30",
      ceremonyTime: "13:30",
      mocktailTime: "14:00",
      dinnerTime: "17:00",
      danceTime: "19:30",
      dressCode: "Garden formal. Sentuhan warna sage, champagne, atau burgundy akan terasa serasi dengan taman.",
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
