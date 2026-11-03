import { Heart, MapPin, Plane, QrCode } from "lucide-react";
import { PublicInvitationCountdown } from "@/components/public-invitation-countdown";
import { ReferenceDemoRsvp } from "@/components/reference-demo-rsvp";
import { ReferenceEnvelopeIntro } from "@/components/reference-envelope-intro";
import { ReferenceMotionProvider } from "@/components/reference-motion-provider";
import type { InvitationDraft } from "@/lib/invitations";
import type { ReferenceTemplatePreset } from "@/lib/reference-template-presets";
import { isLongInvitationTitle } from "@/templates/shared";

export function ReferenceBoardingPassDemo({ draft, dateString, mapsUrl, preset }: {
  draft: InvitationDraft;
  dateString: string;
  mapsUrl?: string;
  preset: ReferenceTemplatePreset;
}) {
  const names = [draft.hostOne, draft.hostTwo].filter(Boolean);
  const ticketDate = draft.eventDate
    ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${draft.eventDate}T12:00:00+07:00`))
    : "Tanggal akan diumumkan";

  return (
    <ReferenceMotionProvider isExample>
      <main className="reference-invitation reference-invitation--destinasi-cinta" data-template="destinasi-cinta" data-theme-color={draft.themeColor ?? "default"} data-invitation-publication="demo">
        <div className="reference-invitation-frame reference-boarding-page" data-reference-content data-demo-fixture="static-visual-only">
          <section className="reference-boarding-ticket-section" aria-labelledby="reference-boarding-title">
            <p className="reference-boarding-eyebrow">SIMPAN TANGGAL</p>
            <article className="reference-boarding-ticket">
              <header className="reference-boarding-ticket-header">
                <span>TIKET PESAWAT</span>
                <span><Plane size={14} aria-hidden="true" /> MASKAPAI TAMUKITA</span>
              </header>
              <p className="reference-boarding-invited">ANDA DIUNDANG UNTUK</p>
              <h1 className={`reference-hero-title${isLongInvitationTitle(draft) ? " reference-hero-title--long" : ""}`} id="reference-boarding-title" tabIndex={-1}>{names[0]} <i aria-hidden="true">&amp;</i><br />{names[1]}</h1>
              <p className="reference-boarding-tagline">Perjalanan menuju hari bahagia</p>
              <div className="reference-boarding-rule" aria-hidden="true" />
              <div className="reference-boarding-date">
                <span>TANGGAL</span>
                <b>{ticketDate.toUpperCase()}</b>
                <small>{draft.eventTime || "Waktu menyusul"} WIB · {dateString}</small>
              </div>
              <div className="reference-boarding-travel-meta">
                <div><span>PENERBANGAN</span><b>TK-{draft.eventDate.slice(8, 10) || "01"}</b></div>
                <div><span>GERBANG</span><b>RD ♥</b></div>
                <div><span>KELAS</span><b>PERNIKAHAN</b></div>
              </div>
              <div className="reference-boarding-code"><span>KODE UNDANGAN</span><b>RD-{draft.eventDate.replaceAll("-", "") || "TAMU"}</b></div>
              <div className="reference-boarding-destination">
                <span>TUJUAN</span>
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
            <p>HITUNG MUNDUR DIMULAI</p>
            <h2 id="reference-boarding-countdown-title">Menuju hari bahagia kita</h2>
            <PublicInvitationCountdown eventDate={draft.eventDate} eventTime={draft.eventTime} label="" />
          </section>

          <ReferenceDemoRsvp dateString={dateString} />
          <footer className="reference-footer">
            <Heart size={13} fill="currentColor" aria-hidden="true" />
            <span>Dengan kasih, {names.join(" & ")}</span>
            <small>Contoh TamuKita · jawaban konfirmasi kehadiran tidak dikirim atau disimpan</small>
          </footer>
        </div>
        <ReferenceEnvelopeIntro preset={preset} hostOne={draft.hostOne} hostTwo={draft.hostTwo} />
      </main>
    </ReferenceMotionProvider>
  );
}
