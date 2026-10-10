import type { CSSProperties } from "react";
import type { InvitationDraft } from "@/lib/invitations";

export function invitationTitle(draft: InvitationDraft) {
  const hosts = [draft.hostOne, draft.hostTwo].filter(Boolean);
  return draft.eventKind === "Pernikahan" && hosts.length === 2
    ? `${hosts[0]} & ${hosts[1]}`
    : draft.eventTitle || draft.eventKind;
}

export function invitationKicker(draft: InvitationDraft) {
  return draft.eventKind === "Pernikahan" ? "THE WEDDING OF" : draft.eventKind.toUpperCase();
}

export function invitationDate(date: string) {
  if (!date) return "Tanggal menyusul";
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Tanggal menyusul";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(parsed);
}

export function invitationCoverStyle(draft: InvitationDraft): CSSProperties {
  return {
    backgroundImage: draft.coverPhoto
      ? `linear-gradient(180deg, transparent 35%, rgba(13, 22, 33, .68)), url("${draft.coverPhoto}")`
      : undefined,
    backgroundPosition: `${draft.coverPositionX ?? 50}% ${draft.coverPosition}%`,
  };
}
