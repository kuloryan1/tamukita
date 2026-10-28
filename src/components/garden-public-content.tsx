import { ArrowUpRight, MapPin } from "lucide-react";
import { GardenFlourish, GardenPavilion, GardenRose } from "@/components/garden-ornaments";
import { PublicInvitationCountdown } from "@/components/public-invitation-countdown";
import { PublicInvitationRsvp } from "@/components/public-invitation-actions";
import type { InvitationFeatureAccess } from "@/lib/invitation-features";
import type { InvitationDraft } from "@/lib/invitations";

type GardenPublicContentProps = {
  draft: InvitationDraft;
  dateString: string;
  mapsUrl: string | undefined;
  slug: string;
  recipientName?: string;
  guestToken?: string;
  isExample: boolean;
  initialRsvpCount: number;
  featureAccess: InvitationFeatureAccess;
};

export function GardenPublicContent({ draft, dateString, mapsUrl, slug, recipientName, guestToken, isExample, initialRsvpCount, featureAccess }: GardenPublicContentProps) {
  const fields = draft.customFields ?? {};
  const hostNames = [draft.hostOne, draft.hostTwo].filter(Boolean);
  const palette = [
    { name: "sage", color: "#98a187" },
    { name: "champagne", color: "#d9c5a1" },
    { name: "burgundy", color: "#73303b" },
  ].filter(({ name }) => fields.dressCode?.toLowerCase().includes(name));
  const schedule = [
    { label: "Kedatangan tamu", time: fields.guestArrivalTime },
    { label: draft.eventKind === "Pernikahan" ? "Prosesi pernikahan" : "Acara utama", time: fields.ceremonyTime || draft.eventTime },
    { label: "Jamuan pembuka", time: fields.mocktailTime },
    { label: "Makan malam", time: fields.dinnerTime },
    { label: "Tarian", time: fields.danceTime },
  ].filter((item) => item.time);
  const mapQuery = [draft.venue, draft.address].filter(Boolean).join(", ");

  return <div className="garden-story">
    <section className="garden-welcome-section garden-paper" aria-labelledby="garden-welcome-title">
      <div className="garden-public-inner" data-garden-reveal>
        <GardenFlourish />
        <h2 id="garden-welcome-title">Dua hati,<br />satu cerita.</h2>
        <p className="garden-guest-greeting">Kepada {recipientName || "keluarga dan sahabat terkasih"},</p>
        <p>{draft.story || "Dengan penuh kebahagiaan, kami mengundang Anda untuk merayakan awal perjalanan kami bersama."}</p>
        <GardenRose />
      </div>
    </section>

    <div className="garden-countdown-wrap" data-garden-reveal>
      <PublicInvitationCountdown eventDate={draft.eventDate} eventTime={draft.eventTime} id="countdown" label="Menuju hari bahagia" />
      <GardenFlourish />
    </div>

    <section className="garden-events-section garden-paper" id="detail-acara" aria-labelledby="garden-events-title">
      <div className="garden-public-inner" data-garden-reveal>
        <h2 id="garden-events-title">Rangkaian Acara</h2>
        <p className="garden-section-date">{dateString}</p>
        <ol className="garden-event-list">
          {schedule.map((item, index) => <li className="garden-event-row" key={item.label}>
            <time dateTime={item.time}>{item.time?.replace(":", ".")}<small>WIB</small></time>
            <span className="garden-event-marker" aria-hidden="true">{index === 1 ? <GardenRose /> : <span />}</span>
            <span className="garden-event-label">{item.label}</span>
          </li>)}
        </ol>
      </div>
    </section>

    <section className="garden-location-section" aria-labelledby="garden-location-title">
      <div className="garden-public-inner garden-location-card" data-garden-reveal>
        <h2 id="garden-location-title">Lokasi</h2>
        <GardenFlourish />
        <h3>{draft.venue || "Lokasi acara"}</h3>
        <p>{draft.address || "Lokasi acara akan diumumkan."}</p>
        <GardenPavilion />
        {mapsUrl && <>
          {mapQuery && <div className="garden-map-frame"><iframe
            title={`Peta lokasi ${draft.venue || "acara"}`}
            src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          /></div>}
          <a className="garden-map-link" href={mapsUrl} target="_blank" rel="noreferrer"><MapPin size={14} />Buka lokasi di peta<ArrowUpRight size={13} /></a>
        </>}
      </div>
    </section>

    {(fields.dressCode || fields.giftPreference) && <section className="garden-notes-section">
      <div className="garden-public-inner garden-notes-grid">
        {fields.dressCode && <article className="garden-note garden-paper" data-garden-reveal>
          <GardenFlourish />
          <h2>Panduan Busana</h2>
          <p>{fields.dressCode}</p>
          {palette.length > 0 && <div className="garden-color-palette" role="img" aria-label={`Warna inspirasi: ${palette.map(({ name }) => name).join(", ")}`}>{palette.map(({ name, color }) => <span key={name} style={{ backgroundColor: color }} />)}</div>}
        </article>}
        {fields.giftPreference && <article className="garden-note garden-paper" data-garden-reveal>
          <GardenRose />
          <h2>Preferensi Hadiah</h2>
          <p>{fields.giftPreference}</p>
          <GardenFlourish />
        </article>}
      </div>
    </section>}

    {featureAccess.rsvp && <section className="garden-rsvp-section" id="rsvp" aria-labelledby="garden-rsvp-title">
      <div className="garden-public-inner" data-garden-reveal>
        <span className="garden-rsvp-envelope" aria-hidden="true"><span>{hostNames.map((name) => name.charAt(0)).join(" & ")}</span></span>
        <h2 id="garden-rsvp-title">Konfirmasi Kehadiran</h2>
        <p>Kabar kehadiran Anda melengkapi kebahagiaan kami.<br />Sampai bertemu di hari istimewa.</p>
        {isExample
          ? <span className="public-rsvp-demo-status" role="status">Contoh undangan · RSVP nonaktif</span>
          : <PublicInvitationRsvp slug={slug} initialCount={initialRsvpCount} recipientName={recipientName} guestToken={guestToken} />}
      </div>
    </section>}

    <section className="garden-closing-section" aria-label="Salam penutup">
      <GardenFlourish />
      <p>Dengan kasih,</p>
      <h2>{hostNames.join(" & ") || draft.eventTitle}</h2>
      <span>Terima kasih telah menjadi bagian dari cerita kami.</span>
    </section>
  </div>;
}
