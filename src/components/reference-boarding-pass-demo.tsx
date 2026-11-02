import { Heart, MapPin, Plane, QrCode } from "lucide-react";
import { PublicInvitationCountdown } from "@/components/public-invitation-countdown";
import { ReferenceDemoRsvp } from "@/components/reference-demo-rsvp";
import { ReferenceEnvelopeIntro } from "@/components/reference-envelope-intro";
import { ReferenceMotionProvider, ReferenceMotionToggle } from "@/components/reference-motion-provider";
import type { InvitationDraft } from "@/lib/invitations";
import type { ReferenceTemplatePreset } from "@/lib/reference-template-presets";

export function ReferenceBoardingPassDemo({ draft, dateString, mapsUrl, preset }: {
  draft: InvitationDraft;
  dateString: string;
  mapsUrl?: string;
  preset: ReferenceTemplatePreset;
}) {
  const names = [draft.hostOne, draft.hostTwo].filter(Boolean);
  const ticketDate = draft.eventDate
    ? new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${draft.eventDate}T12:00:00+07:00`))
    : "Date to be announced";

  return (
    <ReferenceMotionProvider isExample>
      <main className="reference-invitation reference-invitation--destinasi-cinta" data-template="destinasi-cinta" data-invitation-publication="demo">
        <div className="reference-invitation-frame reference-boarding-page" data-reference-content data-demo-fixture="static-visual-only">
          <ReferenceMotionToggle variant="page" />
          <section className="reference-boarding-ticket-section" aria-labelledby="reference-boarding-title">
            <p className="reference-boarding-eyebrow">SAVE THE DATE</p>
            <article className="reference-boarding-ticket">
              <header className="reference-boarding-ticket-header">
                <span>BOARDING PASS</span>
                <span><Plane size={14} aria-hidden="true" /> TAMUKITA AIR</span>
              </header>
              <p className="reference-boarding-invited">YOU’RE INVITED TO</p>
              <h1 className="reference-hero-title" id="reference-boarding-title" tabIndex={-1}>{names[0]} <i aria-hidden="true">&amp;</i><br />{names[1]}</h1>
              <p className="reference-boarding-tagline">Perjalanan menuju hari bahagia</p>
              <div className="reference-boarding-rule" aria-hidden="true" />
              <div className="reference-boarding-date">
                <span>DATE</span>
                <b>{ticketDate.toUpperCase()}</b>
                <small>{draft.eventTime || "Waktu menyusul"} WIB · {dateString}</small>
              </div>
              <div className="reference-boarding-travel-meta">
                <div><span>FLIGHT</span><b>TK-{draft.eventDate.slice(8, 10) || "01"}</b></div>
                <div><span>GATE</span><b>RD ♥</b></div>
                <div><span>CLASS</span><b>WEDDING</b></div>
              </div>
              <div className="reference-boarding-code"><span>INVITATION CODE</span><b>RD-{draft.eventDate.replaceAll("-", "") || "TAMU"}</b></div>
              <div className="reference-boarding-destination">
                <span>DESTINATION</span>
                <MapPin size={19} aria-hidden="true" />
                <b>{draft.venue || "Tempat acara"}</b>
                <small>{draft.address || "Alamat menyusul"}</small>
                {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">Lihat peta <MapPin size={13} aria-hidden="true" /></a>}
              </div>
              <footer className="reference-boarding-ticket-footer" aria-hidden="true">
                <span className="reference-boarding-barcode" />
                <QrCode size={42} strokeWidth={1.5} />
              </footer>
            </article>
          </section>

          <section className="reference-boarding-countdown" id="countdown" aria-labelledby="reference-boarding-countdown-title">
            <p>THE COUNTDOWN BEGINS</p>
            <h2 id="reference-boarding-countdown-title">Until our day together</h2>
            <PublicInvitationCountdown eventDate={draft.eventDate} eventTime={draft.eventTime} label="" />
          </section>

          <ReferenceDemoRsvp dateString={dateString} />
          <footer className="reference-footer">
            <Heart size={13} fill="currentColor" aria-hidden="true" />
            <span>Dengan kasih, {names.join(" & ")}</span>
            <small>Demo lokal TamuKita · jawaban RSVP tidak dikirim atau disimpan</small>
          </footer>
        </div>
        <ReferenceEnvelopeIntro preset={preset} hostOne={draft.hostOne} hostTwo={draft.hostTwo} isExample />
      </main>
    </ReferenceMotionProvider>
  );
}
