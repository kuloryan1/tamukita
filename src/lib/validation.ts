import { isSlugAllowed, safeHttpsUrl, slugify, type InvitationDraft } from "@/lib/invitations";
import { templateFieldMaximumLength, type Template } from "@/lib/template-sdk";

export type DraftValidation = { valid: boolean; message?: string; step?: number };

function isValidCalendarDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const [, rawYear, rawMonth, rawDay] = match;
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const day = Number(rawDay);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;

  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  return day <= daysInMonth;
}

export function validateInvitationDraft(draft: InvitationDraft): DraftValidation {
  const wedding = draft.eventKind === "Pernikahan";
  if (wedding && (!draft.hostOne.trim() || !draft.hostTwo.trim())) {
    return { valid: false, message: "Isi nama kedua mempelai dulu.", step: 0 };
  }
  if (!wedding && !draft.eventTitle.trim()) {
    return { valid: false, message: "Isi judul acaramu dulu.", step: 0 };
  }
  if (!isValidCalendarDate(draft.eventDate)) {
    return { valid: false, message: "Pilih tanggal acara yang valid.", step: 1 };
  }
  if (!draft.eventTime) return { valid: false, message: "Pilih waktu acara terlebih dahulu.", step: 1 };
  if (!draft.venue.trim()) return { valid: false, message: "Isi nama tempat acara.", step: 1 };
  if (!draft.address.trim()) return { valid: false, message: "Isi alamat lengkap acara.", step: 1 };
  if (draft.mapsUrl.trim() && !safeHttpsUrl(draft.mapsUrl)) {
    return { valid: false, message: "Tautan peta harus menggunakan alamat HTTPS yang valid.", step: 1 };
  }
  const giftDetails = [draft.giftBankName, draft.giftAccountName, draft.giftAccountNumber];
  if (giftDetails.some((value) => value.trim()) && giftDetails.some((value) => !value.trim())) {
    return { valid: false, message: "Lengkapi nama bank, nama pemilik rekening, dan nomor rekening hadiah.", step: 1 };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.templateId)) return { valid: false, message: "Pilih template yang valid.", step: 3 };
  if (!isSlugAllowed(slugify(draft.slug))) {
    return { valid: false, message: "Tautan ini tidak tersedia. Gunakan nama lain yang terdiri dari minimal 3 karakter.", step: 3 };
  }
  return { valid: true };
}

function getTemplateFieldValue(draft: InvitationDraft, key: string) {
  const directValue = (draft as unknown as Record<string, unknown>)[key];
  if (Object.hasOwn(draft, key) && typeof directValue === "string") return directValue;
  const customValue = draft.customFields?.[key];
  return Object.hasOwn(draft.customFields ?? {}, key) && typeof customValue === "string" ? customValue : "";
}

function templateFieldStep(sectionKey: string) {
  if (sectionKey === "identity") return 0;
  if (sectionKey === "media") return 2;
  return 1;
}

export function validateTemplateFields(draft: InvitationDraft, template: Template, onlyStep?: number): DraftValidation {
  for (const section of template.schema.sections) {
    const step = templateFieldStep(section.key);
    if (onlyStep !== undefined && step !== onlyStep) continue;
    for (const field of section.fields) {
      const value = getTemplateFieldValue(draft, field.key);
      if (field.required && !value.trim()) return { valid: false, message: `Isi ${field.label.toLocaleLowerCase("id-ID")} terlebih dahulu.`, step };
      if (!value) continue;
      if (value.length > templateFieldMaximumLength(field)) return { valid: false, message: `${field.label} terlalu panjang.`, step };
      if (field.type === "datetime" && !isValidCalendarDate(value)) return { valid: false, message: `${field.label} harus berupa tanggal yang valid.`, step };
      if (field.type === "time" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) return { valid: false, message: `${field.label} harus menggunakan format waktu yang valid.`, step };
      if (field.type === "url" && !safeHttpsUrl(value)) return { valid: false, message: `${field.label} harus menggunakan tautan HTTPS yang valid.`, step };
    }
  }
  return { valid: true };
}
