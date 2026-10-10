import { CalendarDays, Flower2, MapPin } from "lucide-react";
import type { TemplateRenderProps } from "@/lib/template-sdk";
import { InvitationFamilyDetails, invitationCoverStyle, invitationDate, invitationKicker, invitationTitle } from "@/templates/shared";

export function ElegantCreamTemplate({ draft, recipientName, full = false }: TemplateRenderProps) {
  return (
    <article className={`invite-preview invite-preview--cream template-code-renderer template-code-renderer--cream${full ? " invite-preview--full" : ""}`} data-template="elegant-cream">
      <header className="template-cream-heading">
        <span>{invitationKicker(draft)}</span>
        <h2>{invitationTitle(draft)}</h2>
        <i aria-hidden="true" />
      </header>
      <div className="invite-photo template-cream-photo" style={invitationCoverStyle(draft)}>
        {!draft.coverPhoto && <Flower2 className="template-cream-flower" aria-hidden="true" />}
        <span className="template-cream-date">{invitationDate(draft.eventDate)}</span>
      </div>
      <div className="invite-details template-cream-details">
        <p className="invite-greeting">Kepada Yth.{recipientName ? ` ${recipientName}` : ""}</p>
        <InvitationFamilyDetails draft={draft} />
        <p className="invite-message">{draft.story || "Dengan hangat, kami menantikan kehadiran Anda di hari istimewa kami."}</p>
        <div className="template-cream-event"><CalendarDays size={14} /><span>{draft.eventTime || "Waktu menyusul"} WIB</span><MapPin size={14} /><span>{draft.venue || "Lokasi acara"}</span></div>
        {full && <div className="invite-footer-wordmark">sebuah cerita · TamuKita</div>}
      </div>
    </article>
  );
}
