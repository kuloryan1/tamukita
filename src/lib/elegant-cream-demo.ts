import { createDemoDraft, type InvitationDraft } from "@/lib/invitations";

export const ELEGANT_CREAM_DEMO_CALENDAR_HREF = "/api/templates/demo/calendar?template=elegant-cream";

export const elegantCreamDemoEvent = {
  hostOne: "Ryan Pratama",
  hostTwo: "Dwi Wulan Maulida",
  hostOneParents: "Bpk. Mismanto & Ibu Farida",
  hostTwoParents: "Bpk. Suyitno & Ibu Sri Indriati",
  eventDate: "2026-11-21",
  eventTime: "19:00",
  venue: "Gedung Graha Wisata Surabaya",
  address: "Blok N–O, Jl. Wisata Menanggal No. 38, Dukuh Menanggal, Kec. Gayungan, Surabaya",
  story: "Dengan penuh syukur, kami mengundang Anda untuk merayakan hari istimewa ini bersama.",
} as const;

export function createElegantCreamDemoDraft(templateVersion: string): InvitationDraft {
  const location = [elegantCreamDemoEvent.venue, elegantCreamDemoEvent.address].join(", ");
  return {
    ...createDemoDraft(),
    ...elegantCreamDemoEvent,
    slug: "demo-elegant-cream",
    templateId: "elegant-cream",
    templateVersion,
    sealMonogram: "WR",
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`,
    coverPhoto: "/qa-fixtures/couple-cover.webp",
    customFields: {
      eventSectionHeading: "Detail Acara",
      closingNames: "Ryan & Wulan",
    },
  };
}
