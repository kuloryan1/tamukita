import { isSafeTemplateFieldKey } from "@/lib/template-sdk";
import type { InvitationThemeColor } from "@/lib/invitation-theme-colors";
import { isTemplateListed } from "@/lib/template-visibility";
import { templates } from "@/lib/templates";

export const EVENT_KINDS = [
  "Pernikahan",
  "Ulang Tahun",
  "Khitan",
  "Acara Perusahaan",
  "Pertunangan",
  "Acara Lainnya",
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

export type InvitationEventScheduleItem = {
  id: string;
  time: string;
  title: string;
  description: string;
};

export type InvitationGiftAccount = {
  id: "first" | "second";
  recipientLabel: string;
  bankName: string;
  accountName: string;
  accountNumber: string;
};

export const EVENT_KIND_TITLE_SUGGESTIONS: Record<EventKind, string> = {
  Pernikahan: "Undangan Pernikahan",
  "Ulang Tahun": "Perayaan Ulang Tahun",
  Khitan: "Acara Khitan",
  "Acara Perusahaan": "Acara Perusahaan",
  Pertunangan: "Hari Pertunangan",
  "Acara Lainnya": "Undangan Acara",
};

export function familyDetailsPrompt(kind: EventKind) {
  switch (kind) {
    case "Pernikahan":
    case "Pertunangan":
      return { label: "Keluarga yang turut mengundang", placeholder: "Contoh: Keluarga Bapak Hadi dan Ibu Rina" };
    case "Khitan":
      return { label: "Nama keluarga / orang tua", placeholder: "Contoh: Keluarga Bapak Hadi dan Ibu Rina" };
    case "Acara Perusahaan":
      return { label: "Penyelenggara", placeholder: "Nama perusahaan atau organisasi" };
    case "Ulang Tahun":
    case "Acara Lainnya":
      return { label: "Keluarga / penyelenggara", placeholder: "Nama keluarga atau pihak yang mengundang" };
  }
}

export type InvitationDraft = {
  id: string;
  slug: string;
  eventKind: EventKind;
  childrenInvited: boolean;
  eventTitle: string;
  hostOne: string;
  hostTwo: string;
  hostOneParents?: string;
  hostTwoParents?: string;
  sealMonogram?: string;
  familyDetails: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  address: string;
  mapsUrl: string;
  story: string;
  templateId: string;
  templateVersion: string;
  themeColor?: InvitationThemeColor;
  themeFont?: "classic" | "modern";
  sectionOrder?: "story-first" | "details-first";
  coverPhoto: string;
  hostOnePhoto?: string;
  hostTwoPhoto?: string;
  coverPosition: number;
  coverPositionX: number;
  galleryPhotos: string[];
  eventSchedule: InvitationEventScheduleItem[];
  giftMessage: string;
  giftBankName: string;
  giftAccountName: string;
  giftAccountNumber: string;
  giftBankName2: string;
  giftAccountName2: string;
  giftAccountNumber2: string;
  musicUrl: string;
  musicTitle: string;
  customFields: Record<string, string>;
  updatedAt: string;
  publishedAt?: string;
  isPublished?: boolean;
};

export type RSVPEntry = {
  slug: string;
  name: string;
  attendance: "Hadir" | "Berhalangan";
  createdAt: string;
};

const DRAFT_KEY = "tamukita.invitation.draft.v1";
const PUBLISHED_KEY = "tamukita.invitations.published.v1";
const RSVP_KEY = "tamukita.rsvps.v1";

export const DEMO_COUPLE_NAMES = {
  hostOne: "Ryan Pratam",
  hostTwo: "Dwi Wulan Maulida",
} as const;
export const BUILT_IN_DEMO_SLUGS = ["ryan-wulan", "nara-dimas"] as const;

export function isBuiltInDemoSlug(slug: string) {
  return (BUILT_IN_DEMO_SLUGS as readonly string[]).includes(slug);
}

export const reservedSlugs = new Set([
  "admin",
  "api",
  "dashboard",
  "demo",
  "developers",
  "forgot-password",
  "login",
  "paparazi",
  "register",
  "reseller",
  "reset-password",
  "templates",
  "verify-email",
]);

export function createInitialDraft(): InvitationDraft {
  const template = templates.find((candidate) => isTemplateListed(candidate.slug)) ?? templates[0];
  return {
    id: "invitation-demo",
    slug: "ryan-wulan",
    eventKind: "Pernikahan",
    childrenInvited: true,
    eventTitle: "Undangan Pernikahan",
    hostOne: "Ryan",
    hostTwo: "Wulan",
    hostOneParents: "",
    hostTwoParents: "",
    sealMonogram: "",
    familyDetails: "",
    eventDate: "2027-05-22",
    eventTime: "10:00",
    venue: "Rumah Taman",
    address: "Jl. Kemang Raya No. 12, Jakarta Selatan",
    mapsUrl: "",
    story: "Dengan penuh kebahagiaan, kami mengundang Anda untuk menjadi bagian dari hari istimewa kami.",
    templateId: template.slug,
    templateVersion: template.version,
    themeColor: "default",
    themeFont: "classic",
    sectionOrder: "story-first",
    coverPhoto: "",
    hostOnePhoto: "",
    hostTwoPhoto: "",
    coverPosition: 50,
    coverPositionX: 50,
    galleryPhotos: [],
    eventSchedule: [],
    giftMessage: "",
    giftBankName: "",
    giftAccountName: "",
    giftAccountNumber: "",
    giftBankName2: "",
    giftAccountName2: "",
    giftAccountNumber2: "",
    musicUrl: "",
    musicTitle: "",
    customFields: {},
    updatedAt: new Date().toISOString(),
  };
}

export function invitationGiftAccounts(draft: Pick<InvitationDraft, "eventKind" | "hostOne" | "hostTwo" | "giftBankName" | "giftAccountName" | "giftAccountNumber" | "giftBankName2" | "giftAccountName2" | "giftAccountNumber2">): InvitationGiftAccount[] {
  const recipientLabels = draft.eventKind === "Pernikahan"
    ? [`Mempelai laki-laki${draft.hostOne ? ` · ${draft.hostOne}` : ""}`, `Mempelai perempuan${draft.hostTwo ? ` · ${draft.hostTwo}` : ""}`]
    : ["Penerima utama", "Penerima kedua"];
  const accounts: InvitationGiftAccount[] = [
    { id: "first", recipientLabel: recipientLabels[0], bankName: draft.giftBankName, accountName: draft.giftAccountName, accountNumber: draft.giftAccountNumber },
    { id: "second", recipientLabel: recipientLabels[1], bankName: draft.giftBankName2, accountName: draft.giftAccountName2, accountNumber: draft.giftAccountNumber2 },
  ];
  return accounts.filter((account) => account.bankName.trim() && account.accountName.trim() && account.accountNumber.trim());
}

export function createDemoDraft(): InvitationDraft {
  return {
    ...createInitialDraft(),
    slug: "contoh-undangan",
    ...DEMO_COUPLE_NAMES,
    sealMonogram: "RD",
  };
}

export function normalizeInvitationCustomFields(value: unknown): Record<string, string> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const fields: Record<string, string> = Object.create(null);
  for (const [key, fieldValue] of Object.entries(value).slice(0, 96)) {
    if (isSafeTemplateFieldKey(key) && typeof fieldValue === "string" && fieldValue.length <= 1_000) {
      fields[key] = fieldValue;
    }
  }
  return fields;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function isSlugAllowed(value: string) {
  const slug = slugify(value);
  return slug.length >= 3 && !reservedSlugs.has(slug);
}

export function safeHttpsUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function loadDraft(): InvitationDraft {
  if (typeof window === "undefined") return createInitialDraft();
  try {
    const stored = window.localStorage.getItem(DRAFT_KEY);
    if (!stored) return createInitialDraft();
    const parsed: unknown = JSON.parse(stored);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? { ...createInitialDraft(), ...parsed }
      : createInitialDraft();
  } catch {
    return createInitialDraft();
  }
}

export function saveDraft(draft: InvitationDraft) {
  if (typeof window === "undefined") return false;
  const updated = { ...draft, updatedAt: new Date().toISOString() };
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(updated));
    return true;
  } catch {
    return false;
  }
}

export function publishDraft(draft: InvitationDraft) {
  if (typeof window === "undefined") return;
  const published = { ...draft, publishedAt: new Date().toISOString() };
  const current = getPublishedInvitations();
  current[published.slug] = published;
  try {
    window.localStorage.setItem(PUBLISHED_KEY, JSON.stringify(current));
    saveDraft(published);
    return published;
  } catch {
    return undefined;
  }
}

export function getPublishedInvitations(): Record<string, InvitationDraft> {
  if (typeof window === "undefined") return {};
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PUBLISHED_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, InvitationDraft>
      : {};
  } catch {
    return {};
  }
}

export function getPublishedInvitation(slug: string) {
  return getPublishedInvitations()[slug];
}

export function getRSVPs(): RSVPEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RSVP_KEY) || "[]");
    return Array.isArray(parsed) ? parsed as RSVPEntry[] : [];
  } catch {
    return [];
  }
}

export function saveRSVP(entry: RSVPEntry) {
  if (typeof window === "undefined") return false;
  const existing = getRSVPs();
  try {
    window.localStorage.setItem(RSVP_KEY, JSON.stringify([entry, ...existing]));
    return true;
  } catch {
    return false;
  }
}
