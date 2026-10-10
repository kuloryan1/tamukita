import { CalendarDays, MapPin, Sprout } from "lucide-react";
import type { TemplateRenderProps } from "@/lib/template-sdk";
import { InvitationFamilyDetails, invitationCoverStyle, invitationDate, invitationKicker, invitationTitle } from "@/templates/shared";

export function ModernSageTemplate({ draft, recipientName, full = false }: TemplateRenderProps) {
  return (
    <article className={`invite-preview invite-preview--sage template-code-renderer template-code-renderer--sage${full ? " invite-preview--full" : ""}`} data-template="modern-sage">
      <header className="template-sage-heading">
        <Sprout size={18} aria-hidden="true" />
        <span>{invitationKicker(draft)}</span>
        <h2>{invitationTitle(draft)}</h2>
      </header>
      <div className="invite-photo template-sage-photo" style={invitationCoverStyle(draft)}>
        {!draft.coverPhoto && <span className="invite-photo-monogram">{[draft.hostOne, draft.hostTwo].filter(Boolean).map((name) => name[0]).join(" & ") || "T&K"}</span>}
        <span className="template-sage-date">{invitationDate(draft.eventDate)}</span>
      </div>
      <div className="invite-details template-sage-details">
        <p className="invite-greeting">Kepada Yth.{recipientName ? ` ${recipientName}` : ""}</p>
        <InvitationFamilyDetails draft={draft} />
        <p className="invite-message">{draft.story || "Mari hadir dan berbagi cerita di hari istimewa kami."}</p>
        <div className="template-sage-event"><span><CalendarDays size={14} />{draft.eventTime || "Waktu menyusul"} WIB</span><span><MapPin size={14} />{draft.venue || "Lokasi acara"}</span></div>
        {full && <div className="invite-footer-wordmark">dirancang sederhana · TamuKita</div>}
      </div>
    </article>
  );
}
