import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, CalendarDays, Gift, Heart, MapPin, Send, Sparkles } from "lucide-react";
import { PublicInvitationCountdown } from "@/components/public-invitation-countdown";
import { GardenEnvelopeIntro } from "@/components/garden-envelope-intro";
import { GardenPublicContent } from "@/components/garden-public-content";
import { PublicInvitationReport } from "@/components/public-invitation-report";
import { PublicInvitationGiftCopy, PublicInvitationGuestbook, PublicInvitationMusic, PublicInvitationRsvp } from "@/components/public-invitation-actions";
import { legacyInvitationFeatureAccess, type InvitationFeatureAccess } from "@/lib/invitation-features";
import { safeHttpsUrl, type InvitationDraft } from "@/lib/invitations";

type GuestbookMessage = { id: string; displayName: string; message: string; createdAt: string };

export function PublicInvitation({ slug, initialDraft, initialRsvpCount, initialGuestbook = [], recipientName, guestToken, isExample = false, preview, templateSlug, sharePath, featureAccess = legacyInvitationFeatureAccess }: {
  slug: string;
  initialDraft: InvitationDraft;
  initialRsvpCount: number;
  initialGuestbook?: GuestbookMessage[];
  recipientName?: string;
  guestToken?: string;
  isExample?: boolean;
  preview: ReactNode;
  templateSlug?: string;
  sharePath?: string;
  featureAccess?: InvitationFeatureAccess;
}) {
  const draft = initialDraft;
  const hostNames = [draft.hostOne, draft.hostTwo].filter(Boolean);
  const dateString = draft.eventDate
    ? new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${draft.eventDate}T12:00:00+07:00`))
    : "Tanggal akan diumumkan";
  const mapsUrl = safeHttpsUrl(draft.mapsUrl);
  const activeTemplateSlug = templateSlug || draft.templateId;
  const isGardenTemplate = activeTemplateSlug === "taman-abadi";
  const invitationUrl = new URL(sharePath || `/${encodeURIComponent(slug)}`, process.env.NEXT_PUBLIC_APP_URL || "https://tamukita.io").toString();
  const shareText = `${draft.eventKind === "Pernikahan" ? `Undangan pernikahan ${hostNames.join(" & ")}` : draft.eventTitle} — ${invitationUrl}`;

  return (
    <main className="public-invitation-page" data-template={activeTemplateSlug} data-invitation-publication={isExample ? "demo" : "published"} data-theme-font={draft.themeFont ?? "classic"}>
      {isGardenTemplate && <GardenEnvelopeIntro hostOne={draft.hostOne} hostTwo={draft.hostTwo} monogram={draft.sealMonogram} />}
      <div className="public-topbar">
        <Link href="/" className="public-brand"><Heart size={14} fill="currentColor" /> tamukita</Link>
        <span>UNDANGAN DIGITAL</span>
        {isExample && <span className="public-demo-pill">CONTOH</span>}
        {draft.musicUrl && featureAccess.music && <PublicInvitationMusic src={draft.musicUrl} title={draft.musicTitle} />}
        <span className="public-top-spacer" />
      </div>
      <div className="public-invitation-layout">
        <div className="public-hero-side">
          <div className="public-ornament public-ornament--one">✳</div><div className="public-ornament public-ornament--two">✧</div>
          <span className="public-eyebrow">HARI YANG KAMI NANTIKAN</span>
          <h1>{draft.eventKind === "Pernikahan" ? <>Dengan penuh sukacita,<br />kami mengundang <em>{recipientName || "Anda"}.</em></> : <>Mari rayakan<br /><em>{draft.eventTitle || draft.eventKind}.</em></>}</h1>
          <p className="public-hero-names">{draft.eventKind === "Pernikahan" ? hostNames.join("  &  ") : draft.eventTitle}</p>
          <span className="public-hero-rule" />
          <p className="public-hero-message">{draft.story}</p>
          <div className="public-date-card"><span className="public-date-icon"><CalendarDays size={17} /></span><span><small>HARI & TANGGAL</small><b>{dateString}</b><small>{draft.eventTime || "Waktu menyusul"} WIB</small></span></div>
          <a className="public-scroll-link" href="#detail-acara">LIHAT DETAIL ACARA <ArrowDown size={14} /></a>
        </div>
        <div className="public-preview-side">{preview}<div className="public-side-caption"><span>Made with <Heart size={12} fill="currentColor" /> by TamuKita</span><span>{slug}</span></div></div>
      </div>
      {!isGardenTemplate && <PublicInvitationCountdown eventDate={draft.eventDate} eventTime={draft.eventTime} />}
      {isGardenTemplate
        ? <GardenPublicContent draft={draft} dateString={dateString} mapsUrl={mapsUrl} slug={slug} recipientName={recipientName} guestToken={guestToken} isExample={isExample} initialRsvpCount={initialRsvpCount} featureAccess={featureAccess} />
        : <section className="public-detail-section" id="detail-acara">
        <div className="public-detail-inner">
          <span className="eyebrow">SIMPAN TANGGALNYA</span><h2>Sampai jumpa di hari <em>bahagia.</em></h2>
          <div className="public-detail-cards">
            <div className="public-detail-card"><span className="detail-card-icon"><CalendarDays size={18} /></span><small>WAKTU</small><b>{dateString}</b><span>{draft.eventTime} WIB</span></div>
            <div className="public-detail-card"><span className="detail-card-icon"><MapPin size={18} /></span><small>LOKASI</small><b>{draft.venue || "Lokasi acara"}</b><span>{draft.address}</span>{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">Buka peta <ArrowUpRight size={13} /></a>}</div>
          </div>
          {isExample
            ? <span className="public-rsvp-demo-status" role="status">Contoh undangan · RSVP nonaktif</span>
            : featureAccess.rsvp && <PublicInvitationRsvp slug={slug} initialCount={initialRsvpCount} recipientName={recipientName} guestToken={guestToken} />}
        </div>
      </section>}
      {featureAccess.galleryLimit > 0 && draft.galleryPhotos.slice(0, featureAccess.galleryLimit).length > 0 && <section className="public-gallery-section"><div className="public-gallery-inner"><span className="eyebrow">POTONGAN CERITA</span><h2>Momen yang ingin <em>kami kenang.</em></h2><div className="public-gallery-grid">{draft.galleryPhotos.slice(0, featureAccess.galleryLimit).map((photo, index) => <figure key={photo}><Image src={photo} alt={`Foto galeri ${index + 1} ${draft.eventKind.toLowerCase()}`} width={640} height={480} sizes="(max-width: 720px) 50vw, 33vw" unoptimized /></figure>)}</div></div></section>}
      {draft.giftBankName && draft.giftAccountName && draft.giftAccountNumber && <section className="public-gift-section"><div className="public-gift-card"><span className="detail-card-icon"><Gift size={18} /></span><span className="eyebrow">TANDA KASIH</span><h2>Kehadiranmu adalah <em>hadiah terindah.</em></h2><p>{draft.giftMessage || "Jika berkenan, kamu dapat mengirimkan tanda kasih melalui rekening berikut."}</p><div className="public-gift-account"><span>{draft.giftBankName}</span><b>{draft.giftAccountName}</b><strong>{draft.giftAccountNumber}</strong><PublicInvitationGiftCopy accountNumber={draft.giftAccountNumber} /></div></div></section>}
      {!isExample && <PublicInvitationGuestbook slug={slug} entries={initialGuestbook} />}
      <footer className="public-footer"><div><Sparkles size={14} /><span>Setiap momen layak diceritakan dengan indah.</span></div><div className="public-footer-actions">{!isExample && <PublicInvitationReport slug={slug} />}{isExample ? <Link href={`/templates/${encodeURIComponent(activeTemplateSlug)}`}><ArrowUpRight size={13} /> Lihat detail template</Link> : <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><Send size={13} /> Bagikan undangan ini</a>}</div></footer>
    </main>
  );
}
