import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, CalendarDays, Gift, Heart, MapPin, Send, Sparkles } from "lucide-react";
import { PublicInvitationCountdown } from "@/components/public-invitation-countdown";
import { PublicInvitationGiftCopy, PublicInvitationGuestbook, PublicInvitationMusic, PublicInvitationRsvp } from "@/components/public-invitation-actions";
import { PublicInvitationReport } from "@/components/public-invitation-report";
import { ReferenceDemoSections } from "@/components/reference-demo-sections";
import { ReferenceDemoRsvp } from "@/components/reference-demo-rsvp";
import { ReferenceBoardingPassDemo } from "@/components/reference-boarding-pass-demo";
import { ReferenceEnvelopeIntro } from "@/components/reference-envelope-intro";
import { ReferenceMotionProvider, ReferenceMotionToggle } from "@/components/reference-motion-provider";
import { ReferenceHeroMedia } from "@/components/reference-hero-media";
import { ReferenceBackdropMedia } from "@/components/reference-backdrop-media";
import { InvitationFamilyDetails, invitationKicker, invitationTitle } from "@/templates/shared";
import { legacyInvitationFeatureAccess, type InvitationFeatureAccess } from "@/lib/invitation-features";
import { safeHttpsUrl, type InvitationDraft } from "@/lib/invitations";
import type { ReferenceTemplatePreset } from "@/lib/reference-template-presets";

type GuestbookEntry = { id: string; displayName: string; message: string; createdAt: string };

export function ReferenceInvitation({
  slug,
  initialDraft: draft,
  preset,
  initialRsvpCount,
  initialGuestbook = [],
  recipientName,
  guestToken,
  isExample = false,
  sharePath,
  featureAccess = legacyInvitationFeatureAccess,
}: {
  slug: string;
  initialDraft: InvitationDraft;
  preset: ReferenceTemplatePreset;
  initialRsvpCount: number;
  initialGuestbook?: GuestbookEntry[];
  recipientName?: string;
  guestToken?: string;
  isExample?: boolean;
  sharePath?: string;
  featureAccess?: InvitationFeatureAccess;
}) {
  const hostNames = [draft.hostOne, draft.hostTwo].filter(Boolean);
  const title = invitationTitle(draft);
  const dateString = draft.eventDate
    ? new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${draft.eventDate}T12:00:00+07:00`))
    : "Tanggal akan diumumkan";
  const mapsUrl = safeHttpsUrl(draft.mapsUrl);
  if (isExample && preset.slug === "destinasi-cinta") {
    return <ReferenceBoardingPassDemo draft={draft} dateString={dateString} mapsUrl={mapsUrl} preset={preset} />;
  }
  const activeUrl = new URL(sharePath || `/${encodeURIComponent(slug)}`, process.env.NEXT_PUBLIC_APP_URL || "https://tamukita.io").toString();
  const shareText = `${draft.eventKind === "Pernikahan" ? `Undangan pernikahan ${hostNames.join(" & ")}` : draft.eventTitle} — ${activeUrl}`;
  const storySection = (
    <section className="reference-story-section" id="cerita" key="story">
      <div className="reference-section-inner">
        <span className="reference-kicker">{invitationKicker(draft)}</span>
        <h2>Kisah yang kami syukuri</h2>
        <span className="reference-flourish" aria-hidden="true">✦　❧　✦</span>
        <p>{draft.story || "Dengan penuh syukur, kami mengundang Anda untuk merayakan hari istimewa ini bersama."}</p>
        <InvitationFamilyDetails draft={draft} />
      </div>
    </section>
  );
  const eventSection = (
    <section className="reference-event-section" id="detail-acara" key="event">
      <div className="reference-section-inner">
        <span className="reference-kicker">SIMPAN TANGGALNYA</span>
        <h2>Sampai jumpa di hari bahagia</h2>
        <div className="reference-event-details">
          <article>
            <CalendarDays size={20} aria-hidden="true" />
            <span>HARI &amp; TANGGAL</span>
            <b>{dateString}</b>
            <small>{draft.eventTime || "Waktu menyusul"} WIB</small>
          </article>
          <article>
            <MapPin size={20} aria-hidden="true" />
            <span>LOKASI ACARA</span>
            <b>{draft.venue || "Lokasi acara"}</b>
            <small>{draft.address || "Alamat akan diumumkan"}</small>
            {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">Buka peta <ArrowUpRight size={13} /></a>}
          </article>
        </div>
      </div>
    </section>
  );
  const orderedStoryAndEvent = draft.sectionOrder === "details-first" ? [eventSection, storySection] : [storySection, eventSection];

  return (
    <ReferenceMotionProvider isExample={isExample}>
      <main className={`reference-invitation reference-invitation--${preset.slug}`} data-template={preset.slug} data-theme-font={draft.themeFont ?? "classic"} data-theme-color={draft.themeColor ?? "default"} data-invitation-publication={isExample ? "demo" : "published"}>
        <div className="reference-invitation-frame" data-reference-content>
          {isExample && <ReferenceMotionToggle variant="page" />}
          {draft.musicUrl && featureAccess.music && <div className="reference-music"><PublicInvitationMusic src={draft.musicUrl} title={draft.musicTitle} /></div>}
          <section className="reference-hero" aria-label="Undangan pernikahan">
            <ReferenceHeroMedia preset={preset} />
            <div className="reference-hero-shade" aria-hidden="true" />
            <div className="reference-hero-copy">
              <span className="reference-hero-kicker">{draft.eventKind === "Pernikahan" ? "THE WEDDING OF" : draft.eventKind.toUpperCase()}</span>
              <h1 className="reference-hero-title" tabIndex={-1}>
                {draft.eventKind === "Pernikahan" && hostNames.length === 2
                  ? <><span>{hostNames[0]}</span><i aria-hidden="true">&amp;</i><span>{hostNames[1]}</span></>
                  : <span>{title}</span>}
              </h1>
              <p className="reference-hero-intro">{preset.slug === "ivory-heritage" || preset.slug === "royal-gold" ? "We are getting married" : preset.slug === "wisteria-senja" ? "He asked, she said yes" : preset.slug === "elegant-cream" ? "Two hearts, one love" : preset.slug === "modern-sage" ? "Finally, we do" : "Dengan bahagia, kami menanti"}</p>
              <span className="reference-hero-divider" aria-hidden="true"><i />✦<i /></span>
              <time dateTime={draft.eventDate}>{dateString}</time>
              <a className="reference-scroll-cue" href={preset.slug === "royal-gold" || preset.slug === "wisteria-senja" ? "#rsvp" : "#countdown"}>{preset.slug === "royal-gold" || preset.slug === "wisteria-senja" ? "Scroll to RSVP" : preset.slug === "modern-sage" ? "Scroll for more details" : "Gulir untuk melihat"} <ArrowDown size={15} aria-hidden="true" /></a>
            </div>
          </section>
          <section className="reference-countdown-section" id="countdown">
            <span className="reference-kicker">HARI YANG KAMI NANTIKAN</span>
            <h2>Countdown</h2>
            {(preset.slug === "blush-serenade" || preset.slug === "ivory-heritage" || preset.slug === "royal-gold") && <p className="reference-countdown-intro">{preset.slug === "blush-serenade" ? "We can’t wait for this moment!" : "We can’t wait until this moment!"}</p>}
            <PublicInvitationCountdown eventDate={draft.eventDate} eventTime={draft.eventTime} label="" />
          </section>
          {isExample
            ? <ReferenceDemoSections draft={draft} dateString={dateString} mapsUrl={mapsUrl} preset={preset} />
            : <>
                {orderedStoryAndEvent}
                {featureAccess.galleryLimit > 0 && draft.galleryPhotos.slice(0, featureAccess.galleryLimit).length > 0 && (
                  <section className="reference-gallery-section" id="galeri">
                    <div className="reference-section-inner">
                      <span className="reference-kicker">POTONGAN CERITA</span>
                      <h2>Momen yang ingin kami kenang</h2>
                      <div className="reference-gallery-grid">{draft.galleryPhotos.slice(0, featureAccess.galleryLimit).map((photo, index) => <figure key={photo}><Image src={photo} alt={`Foto ${index + 1} ${draft.eventKind.toLowerCase()}`} width={640} height={480} sizes="(max-width: 420px) 50vw, 195px" unoptimized /></figure>)}</div>
                    </div>
                  </section>
                )}
                {draft.giftBankName && draft.giftAccountName && draft.giftAccountNumber && (
                  <section className="reference-gift-section" id="hadiah">
                    <div className="reference-section-inner">
                      <Gift size={20} aria-hidden="true" />
                      <span className="reference-kicker">TANDA KASIH</span>
                      <h2>Kehadiranmu adalah hadiah terindah</h2>
                      <p>{draft.giftMessage || "Jika berkenan, Anda dapat mengirimkan tanda kasih melalui rekening berikut."}</p>
                      <div className="reference-gift-account"><span>{draft.giftBankName}</span><b>{draft.giftAccountName}</b><strong>{draft.giftAccountNumber}</strong><PublicInvitationGiftCopy accountNumber={draft.giftAccountNumber} /></div>
                    </div>
                  </section>
                )}
              </>}
          {featureAccess.rsvp && (isExample
            ? <ReferenceDemoRsvp dateString={dateString} />
            : <section className="reference-rsvp-section" id="rsvp">
                <div className="reference-section-inner">
                  <span className="reference-kicker">KABAR KEHADIRAN</span>
                  <h2>Merupakan kebahagiaan bagi kami bila Anda hadir</h2>
                  <PublicInvitationRsvp slug={slug} initialCount={initialRsvpCount} recipientName={recipientName} guestToken={guestToken} />
                </div>
              </section>)}
          {!isExample && <PublicInvitationGuestbook slug={slug} entries={initialGuestbook} />}
          <footer className="reference-footer">
            <Sparkles size={15} aria-hidden="true" />
            <span>Dengan kasih, {hostNames.join(" & ") || draft.eventTitle}</span>
            <div className="reference-footer-actions">
              {!isExample && <PublicInvitationReport slug={slug} />}
              {isExample
                ? <Link href={`/templates/${encodeURIComponent(preset.slug)}`}>Detail template <ArrowUpRight size={13} /></Link>
                : <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><Send size={13} /> Bagikan undangan</a>}
            </div>
            <small>Dibuat dengan <Heart size={12} fill="currentColor" /> TamuKita</small>
          </footer>
        </div>
        {(preset.slug === "blush-serenade" || preset.slug === "wisteria-senja" || preset.slug === "elegant-cream" || preset.slug === "modern-sage") && <ReferenceBackdropMedia preset={preset} />}
        <ReferenceEnvelopeIntro preset={preset} hostOne={draft.hostOne} hostTwo={draft.hostTwo} isExample={isExample} />
      </main>
    </ReferenceMotionProvider>
  );
}
