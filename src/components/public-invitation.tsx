import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, CalendarDays, Gift, Heart, MapPin, Send, Sparkles } from "lucide-react";
import { PublicInvitationCountdown } from "@/components/public-invitation-countdown";
import { GardenEnvelopeIntro } from "@/components/garden-envelope-intro";
import { GardenPublicContent } from "@/components/garden-public-content";
import { PublicInvitationReport } from "@/components/public-invitation-report";
import { InvitationPaparazzi } from "@/components/invitation-paparazzi";
import { PublicInvitationGiftCopy, PublicInvitationGuestbook, PublicInvitationMusic, PublicInvitationRsvp } from "@/components/public-invitation-actions";
import { legacyInvitationFeatureAccess, type InvitationFeatureAccess } from "@/lib/invitation-features";
import { invitationCopy, type InvitationCopyKey } from "@/lib/invitation-copy";
import { invitationGiftAccounts, safeHttpsUrl, type InvitationDraft } from "@/lib/invitations";

type GuestbookMessage = { id: string; displayName: string; message: string; createdAt: string };

export function PublicInvitation({ slug, initialDraft, initialRsvpCount, initialGuestbook = [], recipientName, guestToken, isExample = false, demoLabel, preview, templateSlug, sharePath, paparazziToken, paparazziOpen = false, featureAccess = legacyInvitationFeatureAccess }: {
  slug: string;
  initialDraft: InvitationDraft;
  initialRsvpCount: number;
  initialGuestbook?: GuestbookMessage[];
  recipientName?: string;
  guestToken?: string;
  isExample?: boolean;
  demoLabel?: string;
  preview: ReactNode;
  templateSlug?: string;
  sharePath?: string;
  paparazziToken?: string;
  paparazziOpen?: boolean;
  featureAccess?: InvitationFeatureAccess;
}) {
  const draft = initialDraft;
  const copy = (key: InvitationCopyKey, fallback?: string) => invitationCopy(draft, key, fallback);
  const hostNames = [draft.hostOne, draft.hostTwo].filter(Boolean);
  const dateString = draft.eventDate
    ? new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${draft.eventDate}T12:00:00+07:00`))
    : "Tanggal akan diumumkan";
  const mapQuery = [draft.venue, draft.address].filter(Boolean).join(", ");
  const mapsUrl = safeHttpsUrl(draft.mapsUrl) || (mapQuery ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}` : "");
  const eventSchedule = (draft.eventSchedule ?? []).filter((item) => item.time.trim() && item.title.trim());
  const giftAccounts = invitationGiftAccounts(draft);
  const activeTemplateSlug = templateSlug || draft.templateId;
  const isGardenTemplate = activeTemplateSlug === "taman-abadi";
  const invitationUrl = new URL(sharePath || `/${encodeURIComponent(slug)}`, process.env.NEXT_PUBLIC_APP_URL || "https://tamukita.io").toString();
  const shareText = `${draft.eventKind === "Pernikahan" ? `Undangan pernikahan ${hostNames.join(" & ")}` : draft.eventTitle} — ${invitationUrl}`;

  return (
    <main className="public-invitation-page" data-template={activeTemplateSlug} data-invitation-publication={isExample ? "demo" : "published"} data-theme-font={draft.themeFont ?? "classic"} data-theme-color={draft.themeColor ?? "default"}>
      {isGardenTemplate && <GardenEnvelopeIntro hostOne={draft.hostOne} hostTwo={draft.hostTwo} monogram={draft.sealMonogram} isExample={isExample} />}
      <div className="public-topbar">
        <Link href="/" className="public-brand"><Heart size={14} fill="currentColor" /> tamukita</Link>
        <span>{copy("publicBrandLabel", "UNDANGAN DIGITAL")}</span>
        {isExample && <span className="public-demo-pill">{demoLabel ?? "CONTOH"}</span>}
        {draft.musicUrl && featureAccess.music && <PublicInvitationMusic src={draft.musicUrl} title={draft.musicTitle} />}
        <span className="public-top-spacer" />
      </div>
      <div className="public-invitation-layout">
        <div className="public-hero-side">
          <div className="public-ornament public-ornament--one">✳</div><div className="public-ornament public-ornament--two">✧</div>
          <span className="public-eyebrow">{invitationCopy(draft, "coverEyebrow", "HARI YANG KAMI NANTIKAN")}</span>
          <h1 style={{ whiteSpace: "pre-line" }}>{invitationCopy(draft, "invitationHeadline", draft.eventKind === "Pernikahan" ? `Dengan penuh sukacita, kami mengundang ${recipientName || "Anda"}.` : `Mari rayakan ${draft.eventTitle || draft.eventKind}.`)}</h1>
          <p className="public-hero-names">{invitationCopy(draft, "invitationTitle", draft.eventKind === "Pernikahan" ? hostNames.join("  &  ") : draft.eventTitle)}</p>
          <span className="public-hero-rule" />
          <p className="public-hero-message">{draft.story}</p>
          <div className="public-date-card"><span className="public-date-icon"><CalendarDays size={17} /></span><span><small>{invitationCopy(draft, "eventDateLabel", "HARI & TANGGAL")}</small><b>{dateString}</b><small>{draft.eventTime || "Waktu menyusul"} WIB</small></span></div>
          <a className="public-scroll-link" href="#detail-acara">{copy("detailLinkLabel", "LIHAT DETAIL ACARA")} <ArrowDown size={14} /></a>
        </div>
        <div className="public-preview-side">{preview}<div className="public-side-caption"><span>{copy("publicCreditLabel", "Dibuat dengan cinta oleh TamuKita")}</span><span>{slug}</span></div></div>
      </div>
      {!isGardenTemplate && <PublicInvitationCountdown eventDate={draft.eventDate} eventTime={draft.eventTime} label={copy("countdownLabel", "Menuju hari bahagia")} />}
      {isGardenTemplate
        ? <GardenPublicContent draft={draft} dateString={dateString} mapsUrl={mapsUrl} slug={slug} recipientName={recipientName} guestToken={guestToken} isExample={isExample} initialRsvpCount={initialRsvpCount} featureAccess={featureAccess} />
        : <section className="public-detail-section" id="detail-acara">
        <div className="public-detail-inner">
          <span className="eyebrow">{invitationCopy(draft, "eventSectionEyebrow", "SIMPAN TANGGALNYA")}</span><h2 style={{ whiteSpace: "pre-line" }}>{invitationCopy(draft, "eventSectionHeading", "Sampai jumpa di hari bahagia.")}</h2>
          <div className="public-detail-cards">
            <div className="public-detail-card"><span className="detail-card-icon"><CalendarDays size={18} /></span><small>{copy("eventTimeLabel", "WAKTU")}</small><b>{dateString}</b><span>{draft.eventTime} WIB</span></div>
            <div className="public-detail-card"><span className="detail-card-icon"><MapPin size={18} /></span><small>{copy("locationLabel", "LOKASI")}</small><b>{draft.venue || "Lokasi acara"}</b><span>{draft.address}</span>{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">{copy("mapActionLabel", "Buka peta")} <ArrowUpRight size={13} /></a>}</div>
          </div>
          {isExample
            ? <span className="public-rsvp-demo-status" role="status">Contoh undangan · konfirmasi kehadiran tidak aktif</span>
            : featureAccess.rsvp && <PublicInvitationRsvp slug={slug} initialCount={initialRsvpCount} recipientName={recipientName} guestToken={guestToken} copy={{ trigger: copy("rsvpJumpLabel", "Konfirmasi kehadiran"), question: copy("rsvpFormQuestion", "Berkenan hadir?"), submit: copy("rsvpSubmitActionLabel", "Kirim konfirmasi") }} />}
        </div>
      </section>}
      {!isGardenTemplate && eventSchedule.length > 0 && <section className="public-schedule-section" id="susunan-acara" aria-labelledby="public-schedule-title"><div className="public-schedule-inner"><span className="eyebrow">{invitationCopy(draft, "scheduleSectionEyebrow", "RANGKAIAN ACARA")}</span><h2 id="public-schedule-title">{invitationCopy(draft, "scheduleSectionHeading", "Susunan acara.")}</h2><p>{invitationCopy(draft, "scheduleSectionIntro", "Setiap momen istimewa telah kami siapkan.")}</p><ol className="public-schedule-list">{eventSchedule.map((item, index) => <li key={item.id}><time dateTime={item.time}>{item.time}<small>WIB</small></time><span className="public-schedule-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div><h3>{item.title}</h3>{item.description && <p>{item.description}</p>}</div></li>)}</ol></div></section>}
      {!isExample && paparazziToken && <InvitationPaparazzi token={paparazziToken} isOpen={paparazziOpen} />}
      {featureAccess.galleryLimit > 0 && draft.galleryPhotos.slice(0, featureAccess.galleryLimit).length > 0 && <section className="public-gallery-section"><div className="public-gallery-inner"><span className="eyebrow">{invitationCopy(draft, "gallerySectionEyebrow", "POTONGAN CERITA")}</span><h2 style={{ whiteSpace: "pre-line" }}>{invitationCopy(draft, "gallerySectionHeading", "Momen yang ingin kami kenang.")}</h2><p>{invitationCopy(draft, "gallerySectionIntro", "Foto-foto kenangan dari hari istimewa kami.")}</p><div className="public-gallery-grid">{draft.galleryPhotos.slice(0, featureAccess.galleryLimit).map((photo, index) => <figure key={photo}><Image src={photo} alt={`Foto galeri ${index + 1} ${draft.eventKind.toLowerCase()}`} width={640} height={480} sizes="(max-width: 720px) 50vw, 33vw" unoptimized /></figure>)}</div></div></section>}
      {giftAccounts.length > 0 && <section className="public-gift-section"><div className="public-gift-card"><span className="detail-card-icon"><Gift size={18} /></span><span className="eyebrow">{copy("giftSectionEyebrow", "TANDA KASIH")}</span><h2 style={{ whiteSpace: "pre-line" }}>{copy("giftSectionHeading", "Kehadiranmu adalah hadiah terindah.")}</h2><p>{draft.giftMessage || copy("giftSectionIntro", "Jika berkenan, kamu dapat mengirimkan tanda kasih melalui rekening berikut.")}</p><div className="public-gift-accounts">{giftAccounts.map((account) => <div className="public-gift-account" key={account.id}><span className="gift-account-recipient">{account.recipientLabel}</span><span>{account.bankName}</span><b>{account.accountName}</b><strong>{account.accountNumber}</strong><PublicInvitationGiftCopy accountNumber={account.accountNumber} label={copy("giftCopyActionLabel", "Salin nomor rekening")} /></div>)}</div></div></section>}
      {!isExample && <PublicInvitationGuestbook slug={slug} entries={initialGuestbook} copy={{ eyebrow: copy("guestbookEyebrow", "UCAPAN & DOA"), heading: copy("guestbookHeading", "Kirimkan doa terbaikmu."), intro: copy("guestbookIntro", "Tinggalkan doa dan pesan hangat untuk hari istimewa kami."), submit: copy("guestbookSubmitActionLabel", "Kirim ucapan") }} />}
      <footer className="public-footer"><div><Sparkles size={14} /><span>{copy("footerMessage", "Setiap momen layak diceritakan dengan indah.")}</span></div><div className="public-footer-actions">{!isExample && <PublicInvitationReport slug={slug} />}{isExample ? <Link href={`/templates/${encodeURIComponent(activeTemplateSlug)}`}><ArrowUpRight size={13} /> Lihat detail desain</Link> : <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><Send size={13} /> {copy("shareActionLabel", "Bagikan undangan")}</a>}</div></footer>
    </main>
  );
}
