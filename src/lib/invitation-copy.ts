import type { InvitationDraft } from "@/lib/invitations";
import type { Template, TemplateSchema, TemplateSchemaField } from "@/lib/template-sdk";

const invitationCopyFields = [
  { key: "stageCaption", type: "text", label: "Keterangan kecil di sampul", defaultValue: "SEBUAH UNDANGAN DARI HATI", maxLength: 120 },
  { key: "coverEyebrow", type: "text", label: "Judul kecil di sampul", defaultValue: "HARI YANG KAMI NANTIKAN", maxLength: 120 },
  { key: "coverMessage", type: "textarea", label: "Pesan di sampul", defaultValue: "Dengan penuh sukacita, kami mengundang Anda.", maxLength: 240 },
  { key: "invitationKicker", type: "text", label: "Keterangan kecil halaman undangan", defaultValue: "", placeholder: "Kosongkan untuk memakai jenis acara", maxLength: 120 },
  { key: "invitationHeadline", type: "textarea", label: "Judul halaman undangan", defaultValue: "Dengan penuh sukacita, kami mengundang Anda.", maxLength: 240 },
  { key: "invitationTitle", type: "text", label: "Judul nama atau acara", defaultValue: "", placeholder: "Kosongkan untuk memakai nama atau judul acara", maxLength: 160 },
  { key: "recipientGreeting", type: "text", label: "Sapaan penerima", defaultValue: "Kepada Yth.", maxLength: 80 },
  { key: "familyDetailsLabel", type: "text", label: "Label keluarga atau penyelenggara", defaultValue: "", placeholder: "Kosongkan untuk mengikuti jenis acara", maxLength: 100 },
  { key: "eventDateLabel", type: "text", label: "Label tanggal acara", defaultValue: "HARI & TANGGAL", maxLength: 80 },
  { key: "eventSectionEyebrow", type: "text", label: "Keterangan kecil bagian acara", defaultValue: "SIMPAN TANGGALNYA", maxLength: 120 },
  { key: "eventSectionHeading", type: "textarea", label: "Judul bagian acara", defaultValue: "Sampai jumpa di hari bahagia.", maxLength: 200 },
  { key: "locationLabel", type: "text", label: "Label lokasi acara", defaultValue: "LOKASI ACARA", maxLength: 80 },
  { key: "scheduleSectionEyebrow", type: "text", label: "Keterangan kecil rundown", defaultValue: "RANGKAIAN ACARA", maxLength: 120 },
  { key: "scheduleSectionHeading", type: "text", label: "Judul rundown", defaultValue: "Susunan acara.", maxLength: 160 },
  { key: "scheduleSectionIntro", type: "textarea", label: "Pengantar rundown", defaultValue: "Setiap momen istimewa telah kami siapkan.", maxLength: 240 },
  { key: "gallerySectionEyebrow", type: "text", label: "Keterangan kecil galeri", defaultValue: "POTONGAN CERITA", maxLength: 120 },
  { key: "gallerySectionHeading", type: "textarea", label: "Judul galeri", defaultValue: "Momen yang ingin kami kenang.", maxLength: 200 },
  { key: "gallerySectionIntro", type: "textarea", label: "Pengantar galeri", defaultValue: "Foto-foto kenangan dari hari istimewa kami.", maxLength: 240 },
  { key: "giftSectionEyebrow", type: "text", label: "Keterangan kecil bagian hadiah", defaultValue: "TANDA KASIH", maxLength: 120 },
  { key: "giftSectionHeading", type: "textarea", label: "Judul bagian hadiah", defaultValue: "Kehadiranmu adalah hadiah terindah.", maxLength: 200 },
  { key: "giftSectionIntro", type: "textarea", label: "Pengantar informasi hadiah", defaultValue: "Jika berkenan, Anda dapat mengirimkan tanda kasih melalui rekening berikut.", maxLength: 300 },
  { key: "rsvpSectionEyebrow", type: "text", label: "Keterangan kecil konfirmasi", defaultValue: "KONFIRMASI KEHADIRAN", maxLength: 120 },
  { key: "rsvpSectionHeading", type: "textarea", label: "Judul bagian konfirmasi", defaultValue: "Sebuah kabar, berarti bagi kami.", maxLength: 200 },
  { key: "rsvpSectionIntro", type: "textarea", label: "Pengantar konfirmasi", defaultValue: "Isi konfirmasi kehadiran dan titipkan ucapan hangat untuk hari istimewa kami.", maxLength: 300 },
] as const satisfies readonly TemplateSchemaField[];

const invitationActionCopyFields = [
  { key: "rsvpFormQuestion", type: "text", label: "Pertanyaan pada formulir konfirmasi", defaultValue: "Berkenan hadir?", maxLength: 160 },
  { key: "closingSectionEyebrow", type: "text", label: "Keterangan kecil penutup", defaultValue: "DENGAN PENUH SUKACITA", maxLength: 120 },
  { key: "closingSectionHeading", type: "textarea", label: "Judul penutup", defaultValue: "Hari istimewa ini, lebih indah bersama Anda.", maxLength: 200 },
  { key: "closingNames", type: "text", label: "Nama di bagian penutup", defaultValue: "", placeholder: "Kosongkan untuk memakai nama depan", maxLength: 160 },
  { key: "countdownLabel", type: "text", label: "Judul hitung mundur", defaultValue: "Menuju hari bahagia", maxLength: 120 },
  { key: "eventTimeLabel", type: "text", label: "Label waktu acara", defaultValue: "WAKTU", maxLength: 80 },
  { key: "detailLinkLabel", type: "text", label: "Teks tautan detail acara", defaultValue: "LIHAT DETAIL ACARA", maxLength: 80 },
  { key: "calendarActionLabel", type: "text", label: "Teks tombol kalender", defaultValue: "Simpan ke kalender", maxLength: 80 },
  { key: "mapActionLabel", type: "text", label: "Teks tombol peta", defaultValue: "Buka peta", maxLength: 80 },
  { key: "rsvpJumpLabel", type: "text", label: "Teks tautan konfirmasi", defaultValue: "Konfirmasi kehadiran", maxLength: 80 },
  { key: "shareActionLabel", type: "text", label: "Teks tombol bagikan", defaultValue: "Bagikan undangan", maxLength: 80 },
  { key: "navInvitationLabel", type: "text", label: "Menu undangan", defaultValue: "Undangan", maxLength: 60 },
  { key: "navEventLabel", type: "text", label: "Menu acara", defaultValue: "Acara", maxLength: 60 },
  { key: "navRsvpLabel", type: "text", label: "Menu kehadiran", defaultValue: "Kehadiran", maxLength: 60 },
  { key: "navGiftLabel", type: "text", label: "Menu hadiah", defaultValue: "Hadiah", maxLength: 60 },
  { key: "footerMessage", type: "text", label: "Pesan singkat di bagian bawah", defaultValue: "Setiap momen layak diceritakan dengan indah.", maxLength: 160 },
  { key: "guestbookEyebrow", type: "text", label: "Keterangan kecil buku ucapan", defaultValue: "UCAPAN & DOA", maxLength: 120 },
  { key: "guestbookHeading", type: "textarea", label: "Judul buku ucapan", defaultValue: "Kirimkan doa terbaikmu.", maxLength: 200 },
  { key: "guestbookIntro", type: "textarea", label: "Pengantar buku ucapan", defaultValue: "Tinggalkan doa dan pesan hangat untuk hari istimewa kami.", maxLength: 300 },
  { key: "openingButtonLabel", type: "text", label: "Teks tombol buka undangan", defaultValue: "Buka undangan", maxLength: 80 },
  { key: "catalogLinkLabel", type: "text", label: "Teks tautan koleksi template", defaultValue: "Koleksi template", maxLength: 80 },
  { key: "reopenCoverLabel", type: "text", label: "Teks tombol lihat sampul", defaultValue: "Lihat sampul", maxLength: 80 },
] as const satisfies readonly TemplateSchemaField[];

const invitationTemplateCopyFields = [
  { key: "gardenWelcomeHeading", type: "textarea", label: "Judul pembuka template taman", defaultValue: "Dua hati, satu cerita.", maxLength: 180 },
  { key: "gardenLocationHeading", type: "text", label: "Judul lokasi template taman", defaultValue: "Lokasi", maxLength: 100 },
  { key: "gardenDressCodeHeading", type: "text", label: "Judul panduan busana", defaultValue: "Panduan Busana", maxLength: 100 },
  { key: "gardenGiftPreferenceHeading", type: "text", label: "Judul preferensi hadiah", defaultValue: "Preferensi Hadiah", maxLength: 100 },
  { key: "gardenClosingMessage", type: "text", label: "Pesan penutup template taman", defaultValue: "Terima kasih telah menjadi bagian dari cerita kami.", maxLength: 200 },
  { key: "boardingTicketEyebrow", type: "text", label: "Keterangan tiket template perjalanan", defaultValue: "TAMUKITA · CATAT TANGGAL", maxLength: 120 },
  { key: "boardingCoverKicker", type: "text", label: "Judul kecil template perjalanan", defaultValue: "PERNIKAHAN DI DESTINASI", maxLength: 120 },
  { key: "boardingCoverSubtitle", type: "text", label: "Pesan template perjalanan", defaultValue: "Perjalanan menuju hari bahagia", maxLength: 160 },
  { key: "boardingDateLabel", type: "text", label: "Label tanggal tiket", defaultValue: "TANGGAL", maxLength: 60 },
  { key: "boardingTimeLabel", type: "text", label: "Label waktu tiket", defaultValue: "WAKTU", maxLength: 60 },
  { key: "boardingDestinationLabel", type: "text", label: "Label tujuan tiket", defaultValue: "TUJUAN", maxLength: 60 },
  { key: "gardenClosingSignoff", type: "text", label: "Salam penutup template taman", defaultValue: "Dengan kasih,", maxLength: 100 },
  { key: "giftCopyActionLabel", type: "text", label: "Teks tombol salin rekening", defaultValue: "Salin nomor rekening", maxLength: 80 },
  { key: "guestbookSubmitActionLabel", type: "text", label: "Teks tombol kirim ucapan", defaultValue: "Kirim ucapan", maxLength: 80 },
  { key: "rsvpSubmitActionLabel", type: "text", label: "Teks tombol kirim konfirmasi", defaultValue: "Kirim konfirmasi", maxLength: 80 },
  { key: "publicBrandLabel", type: "text", label: "Label undangan di halaman publik", defaultValue: "UNDANGAN DIGITAL", maxLength: 80 },
  { key: "publicCreditLabel", type: "text", label: "Keterangan pembuat undangan", defaultValue: "Dibuat dengan cinta oleh TamuKita", maxLength: 120 },
  { key: "gardenEventDateHeading", type: "text", label: "Judul tanggal template taman", defaultValue: "Rangkaian Acara", maxLength: 120 },
] as const satisfies readonly TemplateSchemaField[];

export const INVITATION_COPY_SECTIONS: TemplateSchema["sections"] = [
  { key: "copy", label: "Teks undangan", fields: [...invitationCopyFields] },
  { key: "copy-actions", label: "Teks tombol dan bagian bawah", fields: [...invitationActionCopyFields] },
  { key: "copy-template", label: "Teks khusus template", fields: [...invitationTemplateCopyFields] },
];

const allInvitationCopyFields = [
  ...invitationCopyFields,
  ...invitationActionCopyFields,
  ...invitationTemplateCopyFields,
];
const invitationCopyKeys = new Set<string>(allInvitationCopyFields.map((field) => field.key));
const invitationCopyFieldByKey = new Map<string, TemplateSchemaField>(allInvitationCopyFields.map((field) => [field.key, field]));

export type InvitationCopyKey = (typeof allInvitationCopyFields)[number]["key"];

const copyKeysWithEmptyFallback = new Set<InvitationCopyKey>([
  "invitationKicker",
  "invitationTitle",
  "familyDetailsLabel",
  "closingNames",
]);

export function isInvitationCopyField(key: string) {
  return invitationCopyKeys.has(key);
}

export function invitationCopy(draft: InvitationDraft, key: InvitationCopyKey, fallback?: string) {
  const value = draft.customFields?.[key];
  if (typeof value === "string" && (value.trim() || !copyKeysWithEmptyFallback.has(key))) return value;
  return fallback ?? invitationCopyFieldByKey.get(key)?.defaultValue ?? "";
}

export function getInvitationCopySections(template: Template): TemplateSchema["sections"] {
  const fieldsByKey = new Map(template.schema.sections.flatMap((section) => section.fields).filter((field) => isInvitationCopyField(field.key)).map((field) => [field.key, field]));
  return INVITATION_COPY_SECTIONS.map((section) => ({
    ...section,
    fields: section.fields.flatMap((field) => {
      const available = fieldsByKey.get(field.key);
      return available ? [available] : [];
    }),
  })).filter((section) => section.fields.length > 0);
}

export function ensureInvitationCopySection(template: Template): Template {
  const sections = template.schema.sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => invitationCopyFieldByKey.get(field.key) ?? field),
  }));
  const existingKeys = new Set(sections.flatMap((section) => section.fields.map((field) => field.key)));
  const missingBySection = INVITATION_COPY_SECTIONS.map((section) => ({
    ...section,
    fields: section.fields.filter((field) => !existingKeys.has(field.key)),
  }));
  if (missingBySection.every((section) => section.fields.length === 0)) return template;

  for (const copySection of missingBySection) {
    if (copySection.fields.length === 0) continue;
    const existingIndex = sections.findIndex((section) => section.key === copySection.key);
    if (existingIndex >= 0) {
      const current = sections[existingIndex];
      const additions = copySection.fields.slice(0, Math.max(0, 24 - current.fields.length));
      sections[existingIndex] = { ...current, fields: [...current.fields, ...additions] };
      copySection.fields = copySection.fields.slice(additions.length);
    }
  }

  for (const copySection of missingBySection) {
    if (copySection.fields.length === 0 || sections.length >= 8) continue;
    const fields = copySection.fields.slice(0, 24);
    sections.push({ key: copySection.key, label: copySection.label, fields });
    copySection.fields = copySection.fields.slice(fields.length);
  }

  const remaining = missingBySection.flatMap((section) => section.fields);
  for (const section of sections) {
    if (remaining.length === 0) break;
    const additions = remaining.splice(0, Math.max(0, 24 - section.fields.length));
    if (additions.length > 0) section.fields = [...section.fields, ...additions];
  }

  const fieldCount = sections.reduce((count, section) => count + section.fields.length, 0);
  if (remaining.length > 0 || fieldCount > 96) return template;
  return { ...template, schema: { ...template.schema, sections } };
}
