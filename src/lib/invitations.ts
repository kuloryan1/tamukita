export const EVENT_KINDS = [
  "Pernikahan",
  "Ulang Tahun",
  "Khitan",
  "Acara Perusahaan",
  "Pertunangan",
  "Acara Lainnya",
] as const;

export type EventKind = (typeof EVENT_KINDS)[number];

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
  eventTitle: string;
  hostOne: string;
  hostTwo: string;
  familyDetails: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  address: string;
  mapsUrl: string;
  story: string;
  templateId: string;
  templateVersion: string;
  themeColor?: "default" | "rose" | "ocean";
  themeFont?: "classic" | "modern";
  sectionOrder?: "story-first" | "details-first";
  coverPhoto: string;
  coverPosition: number;
  coverPositionX: number;
  galleryPhotos: string[];
  giftMessage: string;
  giftBankName: string;
  giftAccountName: string;
  giftAccountNumber: string;
  musicUrl: string;
  musicTitle: string;
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

export const reservedSlugs = new Set([
  "admin",
  "api",
  "dashboard",
  "developers",
  "forgot-password",
  "login",
  "register",
  "reseller",
  "reset-password",
  "templates",
  "verify-email",
]);

export function createInitialDraft(): InvitationDraft {
  return {
    id: "invitation-demo",
    slug: "nara-dimas",
    eventKind: "Pernikahan",
    eventTitle: "Undangan Pernikahan",
    hostOne: "Nara",
    hostTwo: "Dimas",
    familyDetails: "",
    eventDate: "2027-05-22",
    eventTime: "10:00",
    venue: "The Garden House",
    address: "Jl. Kemang Raya No. 12, Jakarta Selatan",
    mapsUrl: "",
    story: "Dengan penuh kebahagiaan, kami mengundang Anda untuk menjadi bagian dari hari istimewa kami.",
    templateId: "royal-gold",
    templateVersion: "1.0.0",
    themeColor: "default",
    themeFont: "classic",
    sectionOrder: "story-first",
    coverPhoto: "",
    coverPosition: 50,
    coverPositionX: 50,
    galleryPhotos: [],
    giftMessage: "",
    giftBankName: "",
    giftAccountName: "",
    giftAccountNumber: "",
    musicUrl: "",
    musicTitle: "",
    updatedAt: new Date().toISOString(),
  };
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
