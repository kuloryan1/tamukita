import { CalendarDays, Flower2, MapPin, Plane, Sparkles } from "lucide-react";
import type { InvitationDraft } from "@/lib/invitations";
import type { TemplateRenderProps } from "@/lib/template-sdk";
import { InvitationFamilyDetails, invitationCoverStyle, invitationDate, invitationKicker, invitationTitle, isLongInvitationTitle } from "@/templates/shared";
import { invitationCopy } from "@/lib/invitation-copy";

function InvitationDetailsPanel({
  draft,
  recipientName,
  className,
  message,
  showEventDetails = true,
}: {
  draft: InvitationDraft;
  recipientName?: string;
  className: string;
  message: string;
  showEventDetails?: boolean;
}) {
  return (
    <div className={`invite-details inspired-details ${className}`}>
      <p className="invite-greeting">{invitationCopy(draft, "recipientGreeting", "Kepada Yth.")}{recipientName ? ` ${recipientName}` : ""}</p>
      <InvitationFamilyDetails draft={draft} />
      <p className="invite-message">{draft.story || message}</p>
      {showEventDetails && <>
        <div className="invite-detail-row"><CalendarDays size={15} /><span>{invitationCopy(draft, "eventDateLabel", "HARI & TANGGAL")} · {invitationDate(draft.eventDate)}<small>{invitationCopy(draft, "eventTimeLabel", "WAKTU")} · {draft.eventTime || "Waktu menyusul"} WIB</small></span></div>
        <div className="invite-detail-row"><MapPin size={15} /><span>{invitationCopy(draft, "locationLabel", "LOKASI ACARA")} · {draft.venue || "Nama tempat"}<small>{draft.address || "Alamat acara"}</small></span></div>
      </>}
    </div>
  );
}

export function BlushSerenadeTemplate({ draft, recipientName, full = false }: TemplateRenderProps) {
  return (
    <article className={`invite-preview invite-preview--blush template-code-renderer template-code-renderer--blush${full ? " invite-preview--full" : ""}`} data-template="blush-serenade">
      <div className="invite-photo blush-photo" style={invitationCoverStyle(draft)}>
        {!draft.coverPhoto && <><span className="blush-bloom blush-bloom--one" aria-hidden="true">✿</span><span className="blush-bloom blush-bloom--two" aria-hidden="true">✿</span></>}
        <div className="blush-heading">
          <span>{invitationKicker(draft)}</span>
          <h2 className={isLongInvitationTitle(draft) ? "invite-title--long" : undefined}>{invitationTitle(draft)}</h2>
          <div className="blush-heading-flower"><Flower2 size={16} aria-hidden="true" /><i>✦</i><Flower2 size={16} aria-hidden="true" /></div>
          <time className="blush-photo-date">{invitationDate(draft.eventDate)}</time>
        </div>
      </div>
      <InvitationDetailsPanel draft={draft} recipientName={recipientName} className="blush-details" message="Dengan bahagia, kami menantikan kehadiran Anda untuk merayakan kisah ini bersama." />
      {full && <div className="invite-footer-wordmark">sebuah hari yang indah · TamuKita</div>}
    </article>
  );
}

export function IvoryHeritageTemplate({ draft, recipientName, full = false }: TemplateRenderProps) {
  return (
    <article className={`invite-preview invite-preview--heritage template-code-renderer template-code-renderer--heritage${full ? " invite-preview--full" : ""}`} data-template="ivory-heritage">
      <div className="invite-photo heritage-photo" style={invitationCoverStyle(draft)}>
        {!draft.coverPhoto && <span className="heritage-monogram">{[draft.hostOne, draft.hostTwo].filter(Boolean).map((name) => name[0]).join(" & ") || "T&K"}</span>}
        <div className="heritage-frame" aria-hidden="true"><span>✦</span><span>✦</span></div>
        <div className="heritage-copy">
          <span>{invitationKicker(draft)}</span>
          <Sparkles size={17} aria-hidden="true" />
          <h2 className={isLongInvitationTitle(draft) ? "invite-title--long" : undefined}>{invitationTitle(draft)}</h2>
          <i>{invitationDate(draft.eventDate)}</i>
        </div>
      </div>
      <InvitationDetailsPanel draft={draft} recipientName={recipientName} className="heritage-details" message="Dengan penuh hormat dan sukacita, kami mengundang Anda untuk hadir di perayaan kami." />
      {full && <div className="invite-footer-wordmark">dengan hormat · TamuKita</div>}
    </article>
  );
}

export function WisteriaSenjaTemplate({ draft, recipientName, full = false }: TemplateRenderProps) {
  return (
    <article className={`invite-preview invite-preview--wisteria template-code-renderer template-code-renderer--wisteria${full ? " invite-preview--full" : ""}`} data-template="wisteria-senja">
      <div className="invite-photo wisteria-photo" style={invitationCoverStyle(draft)}>
        {!draft.coverPhoto && <>
          <span className="wisteria-spray wisteria-spray--left" aria-hidden="true">✿　✧　✿</span>
          <span className="wisteria-spray wisteria-spray--right" aria-hidden="true">✿　✧　✿</span>
        </>}
        <div className="wisteria-copy">
          <span>{invitationKicker(draft)}</span>
          <h2 className={isLongInvitationTitle(draft) ? "invite-title--long" : undefined}>{invitationTitle(draft)}</h2>
          <i>{invitationDate(draft.eventDate)}</i>
        </div>
      </div>
      <InvitationDetailsPanel draft={draft} recipientName={recipientName} className="wisteria-details" message="Mari merayakan hari istimewa ini di bawah langit senja yang kita nantikan." />
      {full && <div className="invite-footer-wordmark">sampai di hari bahagia · TamuKita</div>}
    </article>
  );
}

export function DestinasiCintaTemplate({ draft, recipientName, full = false }: TemplateRenderProps) {
  return (
    <article className={`invite-preview invite-preview--boarding template-code-renderer template-code-renderer--boarding${full ? " invite-preview--full" : ""}`} data-template="destinasi-cinta">
      <section className="boarding-ticket">
        <header className="boarding-ticket-heading"><span>{invitationCopy(draft, "boardingTicketEyebrow", "TAMUKITA · CATAT TANGGAL")}</span><Plane size={17} aria-hidden="true" /></header>
        <div className="boarding-ticket-main" style={invitationCoverStyle(draft)}>
          <span>{invitationCopy(draft, "boardingCoverKicker", "PERNIKAHAN DI DESTINASI")}</span>
          <h2 className={isLongInvitationTitle(draft) ? "invite-title--long" : undefined}>{invitationTitle(draft)}</h2>
          <i>{invitationCopy(draft, "boardingCoverSubtitle", "Perjalanan menuju hari bahagia")}</i>
        </div>
        <div className="boarding-ticket-meta">
          <div><small>{invitationCopy(draft, "boardingDateLabel", "TANGGAL")}</small><b>{invitationDate(draft.eventDate)}</b></div>
          <div><small>{invitationCopy(draft, "boardingTimeLabel", "WAKTU")}</small><b>{draft.eventTime || "Menyusul"} WIB</b></div>
          <div><small>{invitationCopy(draft, "boardingDestinationLabel", "TUJUAN")}</small><b>{draft.venue || "Tempat acara"}</b></div>
        </div>
      </section>
      <InvitationDetailsPanel draft={draft} recipientName={recipientName} className="boarding-details" message="Simpan tanggalnya dan mari bertemu di destinasi cerita kami." showEventDetails={false} />
      {full && <div className="invite-footer-wordmark">sampai jumpa di tujuan · TamuKita</div>}
    </article>
  );
}

export function TamanAbadiTemplate({ draft, recipientName, full = false, mode }: TemplateRenderProps) {
  const hostNames = [draft.hostOne, draft.hostTwo].filter(Boolean);
  const Heading = mode === "public" ? "h1" : "h2";
  const [year, month, day] = draft.eventDate.slice(0, 10).split("-");
  const shortDate = year && month && day ? `${day}.${month}.${year.slice(-2)}` : "Tanggal menyusul";
  const coverLabel = draft.eventKind === "Pernikahan" ? "Hari Pernikahan" : draft.eventKind;
  const coverStyle = invitationCoverStyle(draft);
  const backgroundStyle = draft.coverPhoto
    ? coverStyle
    : { ...coverStyle, backgroundImage: "url('/templates/taman-abadi-garden-v2.webp')" };
  return (
    <article className={`invite-preview invite-preview--garden template-code-renderer template-code-renderer--garden${full ? " invite-preview--full" : ""}`} data-template="taman-abadi">
      <div className={`invite-photo garden-photo${draft.coverPhoto ? " garden-photo--image" : ""}`}>
        <span className="garden-photo-art" aria-hidden="true"><span className="garden-photo-drift" style={backgroundStyle} /></span>
        {!draft.coverPhoto && <span className="garden-petals" aria-hidden="true"><i /><i /><i /><i /><i /></span>}
        <div className="garden-copy">
          <span className="garden-kicker">{invitationCopy(draft, "coverEyebrow", coverLabel)}</span>
          <time>{shortDate}</time>
          <Heading className={`garden-copy-heading${isLongInvitationTitle(draft) ? " invite-title--long" : ""}`} tabIndex={mode === "public" ? -1 : undefined}>{draft.customFields?.invitationTitle?.trim()
            ? <span style={{ whiteSpace: "pre-line" }}>{invitationTitle(draft)}</span>
            : draft.eventKind === "Pernikahan" && hostNames.length > 0
            ? <><span>{hostNames[0]}</span>{hostNames[1] && <><i aria-hidden="true">&amp;</i><span>{hostNames[1]}</span></>}</>
            : <span>{invitationTitle(draft)}</span>}
          </Heading>
          {mode !== "public" && <span className="garden-copy-note">{draft.eventKind === "Pernikahan" ? invitationDate(draft.eventDate) : invitationKicker(draft)}</span>}
          {mode === "public" ? <a href="#countdown" className="garden-scroll-cue">Gulir ke bawah <span aria-hidden="true">↓</span></a> : <span className="garden-scroll-cue">Gulir untuk melihat <span aria-hidden="true">↓</span></span>}
        </div>
      </div>
      <InvitationDetailsPanel draft={draft} recipientName={recipientName} className="garden-details" message="Dengan penuh syukur, kami menantikan kehadiran Anda untuk merayakan hari istimewa ini bersama." />
      {full && <div className="invite-footer-wordmark">dengan kasih · TamuKita</div>}
    </article>
  );
}
