export const GUEST_MESSAGE_MAX_LENGTH = 4_000;
export const GUEST_MESSAGE_TOKENS = ["nama_tamu", "nama_acara", "link_undangan"] as const;

export const WEDDING_GUEST_MESSAGE = `Assalamu'alaikum Wr. Wb.
Bismillahirrahmanirrahim.

Yth. {nama_tamu}

Tanpa mengurangi rasa hormat, perkenankan kami mengundang Bapak/Ibu/Saudara/i, teman sekaligus sahabat, untuk menghadiri acara pernikahan kami:

{nama_acara}

Berikut link undangan kami untuk info lengkap dari acara bisa kunjungi:
{link_undangan}

Merupakan suatu kebahagiaan bagi kami apabila Bapak/Ibu/Saudara/i berkenan untuk hadir dan memberikan doa restu.

Mohon maaf perihal undangan hanya dibagikan melalui pesan ini. Terima kasih banyak atas perhatiannya.

Wassalamu'alaikum Wr. Wb.
Terima kasih.`;

export function defaultGuestWhatsAppMessage(eventKind: unknown) {
  return eventKind === "Pernikahan" ? WEDDING_GUEST_MESSAGE
    : "Halo {nama_tamu}, kami ingin mengundang Anda untuk acara {nama_acara}. Silakan buka undangan berikut: {link_undangan}";
}

export function guestMessageError(template: string): string | null {
  if (!template.trim()) return "Isi pesan WhatsApp terlebih dahulu.";
  if (template.length > GUEST_MESSAGE_MAX_LENGTH) return "Pesan WhatsApp maksimal 4.000 karakter.";
  if (!template.includes("{link_undangan}")) return "Sertakan {link_undangan} agar setiap tamu menerima tautan pribadinya.";
  const unknown = [...template.matchAll(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g)]
    .find((match) => !GUEST_MESSAGE_TOKENS.some((token) => token === match[1]));
  return unknown ? `Penanda {${unknown[1]}} tidak dikenal. Gunakan penanda yang tersedia.` : null;
}

export function renderGuestWhatsAppMessage(template: string, values: { name: string; eventTitle: string; url: string }) {
  const replacements = { nama_tamu: values.name, nama_acara: values.eventTitle, link_undangan: values.url };
  return template.replace(/\{(nama_tamu|nama_acara|link_undangan)\}/g,
    (_match, token: keyof typeof replacements) => replacements[token]);
}
