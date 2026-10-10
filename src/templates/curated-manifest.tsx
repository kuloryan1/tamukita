import { CalendarDays, MapPin, Sparkles } from "lucide-react";
import type { TemplateRenderProps } from "@/lib/template-sdk";
import { invitationCoverStyle, invitationDate, invitationKicker, invitationTitle } from "@/templates/shared";

export function CuratedManifestTemplate({ draft, recipientName, full = false, template }: TemplateRenderProps) {
  const style = template?.style ?? "royal";
  return (
    <article className={`invite-preview invite-preview--${style}${full ? " invite-preview--full" : ""}`}>
      <div className="invite-decoration invite-decoration--top"><Sparkles size={17} /></div>
      <div className="invite-decoration invite-decoration--bottom">✳</div>
      <div className="invite-photo" style={invitationCoverStyle(draft)}>
        {!draft.coverPhoto && <span className="invite-photo-monogram">{[draft.hostOne, draft.hostTwo].filter(Boolean).map((name) => name[0]).join(" & ") || "T&K"}</span>}
        <div className="invite-copy"><span className="invite-kicker">{invitationKicker(draft)}</span><h2>{invitationTitle(draft)}</h2><span className="invite-divider" /><span className="invite-date-short">{invitationDate(draft.eventDate)}</span></div>
      </div>
      <div className="invite-details">
        <p className="invite-greeting">Kepada Yth.{recipientName ? ` ${recipientName}` : ""}</p>
        <p className="invite-message">{draft.story || "Dengan penuh kebahagiaan, kami mengundang Anda untuk hadir di hari istimewa kami."}</p>
        <div className="invite-detail-row"><CalendarDays size={15} /><span>{invitationDate(draft.eventDate)}<small>{draft.eventTime || "Waktu menyusul"} WIB</small></span></div>
        <div className="invite-detail-row"><MapPin size={15} /><span>{draft.venue || "Nama tempat"}<small>{draft.address || "Alamat acara"}</small></span></div>
        {full && <div className="invite-footer-wordmark">Dibuat dengan cinta · TamuKita</div>}
      </div>
    </article>
  );
}
