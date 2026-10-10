import { isSlugAllowed, safeHttpsUrl, slugify, type InvitationDraft } from "@/lib/invitations";

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
