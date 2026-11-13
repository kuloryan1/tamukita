import { CalendarDays, Flower2, MapPin } from "lucide-react";
import type { TemplateRenderProps } from "@/lib/template-sdk";
import { InvitationFamilyDetails, invitationCoverStyle, invitationDate, invitationKicker, invitationTitle, isLongInvitationTitle } from "@/templates/shared";
import { invitationCopy } from "@/lib/invitation-copy";
import { getAkadEventDetails } from "@/lib/akad-event";

export function ElegantCreamTemplate({ draft, recipientName, full = false }: TemplateRenderProps) {
  const akadEvent = getAkadEventDetails("elegant-cream", draft.customFields);
  return (
    <article className={`invite-preview invite-preview--cream template-code-renderer template-code-renderer--cream${full ? " invite-preview--full" : ""}`} data-template="elegant-cream">
      <header className="template-cream-heading">
        <span>{invitationKicker(draft)}</span>
        <h2 className={isLongInvitationTitle(draft) ? "invite-title--long" : undefined}>{invitationTitle(draft)}</h2>
        <i aria-hidden="true" />
      </header>
      <div className="invite-photo template-cream-photo" style={invitationCoverStyle(draft)}>
        {!draft.coverPhoto && <Flower2 className="template-cream-flower" aria-hidden="true" />}
        <span className="template-cream-date">{invitationDate(draft.eventDate)}</span>
      </div>
      <div className="invite-details template-cream-details">
        <p className="invite-greeting">{invitationCopy(draft, "recipientGreeting", "Kepada Yth.")}{recipientName ? ` ${recipientName}` : ""}</p>
        <InvitationFamilyDetails draft={draft} />
        {draft.story.trim() && <p className="invite-message">{draft.story}</p>}
        <div className="template-cream-event"><CalendarDays size={14} /><span>{draft.eventTime || "Waktu menyusul"} WIB</span><MapPin size={14} /><span>{draft.venue || "Lokasi acara"}</span></div>
        {akadEvent && <div className="template-cream-akad"><small>AKAD NIKAH</small><b>{akadEvent.dateLabel}{akadEvent.time ? ` · ${akadEvent.time} WIB` : ""}</b>{akadEvent.address && <p>{akadEvent.address}</p>}</div>}
        {full && <div className="invite-footer-wordmark">sebuah cerita · TamuKita</div>}
      </div>
    </article>
  );
}
