export function normalizeWhatsAppPhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let source = value.trim();
  if (!source) return null;

  if (/^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source);
      const host = url.hostname.toLowerCase();
      if (host === "wa.me") source = url.pathname.split("/").filter(Boolean)[0] ?? "";
      else if (host === "api.whatsapp.com" || host === "www.api.whatsapp.com") source = url.searchParams.get("phone") ?? "";
      else return null;
    } catch {
      return null;
    }
  }

  let digits = source.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

export function whatsappShareUrl(phone: string, message: string) {
  const normalized = normalizeWhatsAppPhone(phone);
  return normalized ? `https://wa.me/${normalized}?text=${encodeURIComponent(message)}` : "";
}
