export const MAX_RECIPIENT_LENGTH = 100;

/** Keep display names safe to render and encode without splitting Unicode characters. */
export function normalizeRecipient(value: unknown, fallback = "Anda"): string {
  if (typeof value !== "string") return fallback;

  const clean = Array.from(value)
    .filter((character) => {
      const point = character.codePointAt(0) ?? 0;
      const isControl = point <= 0x1f || (point >= 0x7f && point <= 0x9f);
      const isUnpairedSurrogate = point >= 0xd800 && point <= 0xdfff;
      return !isControl && !isUnpairedSurrogate;
    })
    .join("")
    .trim();

  return Array.from(clean).slice(0, MAX_RECIPIENT_LENGTH).join("") || fallback;
}
