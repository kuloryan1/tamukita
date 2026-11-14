export const MAX_GUESTBOOK_FILTER_WORDS = 50;
export const MAX_GUESTBOOK_FILTER_WORD_LENGTH = 80;

export function normalizeGuestbookFilterWords(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const words: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const word = candidate.trim().slice(0, MAX_GUESTBOOK_FILTER_WORD_LENGTH);
    const normalized = normalizeGuestbookText(word);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    words.push(word);
    if (words.length >= MAX_GUESTBOOK_FILTER_WORDS) break;
  }
  return words;
}

export function getGuestbookFilterWordsFromDraft(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return normalizeGuestbookFilterWords((value as Record<string, unknown>).guestbookBlockedWords);
}

export function guestbookMessageMatchesFilter(message: string, blockedWords: readonly string[]): boolean {
  const normalizedMessage = ` ${normalizeGuestbookText(message)} `;
  if (normalizedMessage.trim() === "") return false;
  return blockedWords.some((word) => {
    const normalizedWord = normalizeGuestbookText(word);
    return normalizedWord !== "" && normalizedMessage.includes(` ${normalizedWord} `);
  });
}

export function getGuestbookEntryStatus(templateId: string, message: string, blockedWords: readonly string[]) {
  return templateId === "elegant-cream" && !guestbookMessageMatchesFilter(message, blockedWords)
    ? "APPROVED" as const
    : "PENDING" as const;
}

function normalizeGuestbookText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
