"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowDown, ArrowUpRight, CalendarDays, CheckCircle2, Copy, Flag, Gift, Heart, MapPin, Music2, Pause, Play, Send, Sparkles, X } from "lucide-react";
import { safeHttpsUrl, type InvitationDraft } from "@/lib/invitations";
import { legacyInvitationFeatureAccess, type InvitationFeatureAccess } from "@/lib/invitation-features";

type GuestbookMessage = { id: string; displayName: string; message: string; createdAt: string };
type ReportReason = "SPAM" | "HARASSMENT" | "PERSONAL_INFORMATION" | "OTHER";

export function PublicInvitation({ slug, initialDraft, initialRsvpCount, initialGuestbook = [], recipientName, guestToken, isExample = false, preview, featureAccess = legacyInvitationFeatureAccess }: { slug: string; initialDraft: InvitationDraft; initialRsvpCount: number; initialGuestbook?: GuestbookMessage[]; recipientName?: string; guestToken?: string; isExample?: boolean; preview: ReactNode; featureAccess?: InvitationFeatureAccess }) {
  const [draft] = useState<InvitationDraft | null>(initialDraft);
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [guestName, setGuestName] = useState(recipientName ?? "");
  const [attendance, setAttendance] = useState<"Hadir" | "Berhalangan">("Hadir");
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  const [rsvpError, setRsvpError] = useState("");
  const [rsvpCount, setRsvpCount] = useState(initialRsvpCount);
  const guestbookEntries = initialGuestbook;
  const [guestbookName, setGuestbookName] = useState("");
  const [guestbookMessage, setGuestbookMessage] = useState("");
  const [guestbookError, setGuestbookError] = useState("");
  const [guestbookSent, setGuestbookSent] = useState(false);
  const [guestbookSending, setGuestbookSending] = useState(false);
  const [reportingEntryId, setReportingEntryId] = useState("");
  const [reportedEntryIds, setReportedEntryIds] = useState<string[]>([]);
  const [reportReason, setReportReason] = useState<ReportReason>("OTHER");
  const [reportError, setReportError] = useState("");
  const [reportBusyId, setReportBusyId] = useState("");
  const [giftCopied, setGiftCopied] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const isReady = true;
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!draft?.eventDate) return;
    // Event dates and times are entered and stored in WIB. Keep the countdown
    // anchored to the event's timezone even when a guest opens the invitation abroad.
    const target = new Date(`${draft.eventDate}T${draft.eventTime || "00:00"}:00+07:00`).getTime();
    const tick = () => {
      const distance = Math.max(0, target - Date.now());
      setCountdown({
        days: Math.floor(distance / 86_400_000),
        hours: Math.floor((distance / 3_600_000) % 24),
        minutes: Math.floor((distance / 60_000) % 60),
        seconds: Math.floor((distance / 1_000) % 60),
      });
    };
    tick();
    const timer = window.setInterval(tick, 1_000);
    return () => window.clearInterval(timer);
  }, [draft?.eventDate, draft?.eventTime]);

  const submitRSVP = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!guestName.trim()) return;
    setRsvpError("");
    const response = await fetch(`/api/public/invitations/${encodeURIComponent(slug)}/rsvp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: guestName.trim(), ...(guestToken ? { guestToken } : {}), attendance: attendance === "Hadir" ? "ATTENDING" : "DECLINED", attendeeCount }),
    }).catch(() => null);
    const result = await response?.json().catch(() => ({})) as { error?: string; created?: boolean } | undefined;
    if (!response?.ok) {
      setRsvpError(result?.error ?? "RSVP belum dapat dikirim. Periksa koneksi dan coba lagi.");
      return;
    }
    if (result?.created) setRsvpCount((count) => count + 1);
    setSubmitted(true);
  };

  const submitGuestbook = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setGuestbookError("");
    setGuestbookSending(true);
    const response = await fetch(`/api/public/invitations/${encodeURIComponent(slug)}/guestbook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: guestbookName.trim(), message: guestbookMessage.trim() }),
    }).catch(() => null);
    const result = await response?.json().catch(() => ({})) as { error?: string } | undefined;
    setGuestbookSending(false);
    if (!response?.ok) {
      setGuestbookError(result?.error ?? "Ucapan belum dapat dikirim. Periksa koneksi dan coba lagi.");
      return;
    }
    setGuestbookName("");
    setGuestbookMessage("");
    setGuestbookSent(true);
  };

  const submitGuestbookReport = async (entryId: string) => {
    setReportBusyId(entryId);
    setReportError("");
    const response = await fetch(`/api/public/invitations/${encodeURIComponent(slug)}/guestbook/${encodeURIComponent(entryId)}/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: reportReason }),
    }).catch(() => null);
    const result = await response?.json().catch(() => ({})) as { error?: string } | undefined;
    setReportBusyId("");
    if (!response?.ok) {
      setReportError(result?.error ?? "Laporan belum dapat dikirim. Coba lagi.");
      return;
    }
    setReportedEntryIds((current) => current.includes(entryId) ? current : [...current, entryId]);
    setReportingEntryId("");
  };

  const copyGiftAccount = async () => {
    try {
      await navigator.clipboard.writeText(draft?.giftAccountNumber ?? "");
      setGiftCopied(true);
      window.setTimeout(() => setGiftCopied(false), 1800);
    } catch {
      setGiftCopied(false);
    }
  };

  const toggleMusic = async () => {
    const audio = musicRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    await audio.play().catch(() => setMusicPlaying(false));
  };

  if (!isReady) return <main className="public-not-found"><Heart size={28} /><p>Membuka undangan...</p></main>;
  if (!draft) return <main className="public-not-found"><Heart size={28} /><h1>Undangan belum tersedia</h1><p>Periksa kembali tautannya atau tanyakan kepada pengundang.</p><Link href="/">Kembali ke TamuKita</Link></main>;
  const hostNames = [draft.hostOne, draft.hostTwo].filter(Boolean);
  const dateString = draft.eventDate ? new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${draft.eventDate}T00:00:00`)) : "Tanggal akan diumumkan";
  const mapsUrl = safeHttpsUrl(draft.mapsUrl);
  const invitationUrl = new URL(`/${encodeURIComponent(slug)}`, process.env.NEXT_PUBLIC_APP_URL || "https://tamukita.io").toString();
  const shareText = `${draft.eventKind === "Pernikahan" ? `Undangan pernikahan ${hostNames.join(" & ")}` : draft.eventTitle} — ${invitationUrl}`;

  return (
    <main className="public-invitation-page">
      <div className="public-topbar"><Link href="/" className="public-brand"><Heart size={14} fill="currentColor" /> tamukita</Link><span>UNDANGAN DIGITAL</span>{isExample && <span className="public-demo-pill">CONTOH</span>}{draft.musicUrl && featureAccess.music && <>{/* biome-ignore lint/a11y/useMediaCaption: Optional background music has no speech or dialogue to caption. */}<audio ref={musicRef} src={draft.musicUrl} loop preload="none" onPlay={() => setMusicPlaying(true)} onPause={() => setMusicPlaying(false)} /><button type="button" className="public-music-toggle" onClick={() => void toggleMusic()} aria-label={`${musicPlaying ? "Jeda" : "Putar"} musik latar${draft.musicTitle ? `: ${draft.musicTitle}` : ""}`} title={draft.musicTitle || undefined}>{musicPlaying ? <Pause size={13} /> : <Play size={13} />}<Music2 size={13} /><span>{musicPlaying ? "Jeda musik" : "Putar musik"}</span></button></>}<span className="public-top-spacer" /></div>
      <div className="public-invitation-layout"><div className="public-hero-side"><div className="public-ornament public-ornament--one">✳</div><div className="public-ornament public-ornament--two">✧</div><span className="public-eyebrow">HARI YANG KAMI NANTIKAN</span><h1>{draft.eventKind === "Pernikahan" ? <>Dengan penuh sukacita,<br />kami mengundang <em>{recipientName || "Anda"}.</em></> : <>Mari rayakan<br /><em>{draft.eventTitle || draft.eventKind}.</em></>}</h1><p className="public-hero-names">{draft.eventKind === "Pernikahan" ? hostNames.join("  &  ") : draft.eventTitle}</p><span className="public-hero-rule" /><p className="public-hero-message">{draft.story}</p><div className="public-date-card"><span className="public-date-icon"><CalendarDays size={17} /></span><span><small>HARI & TANGGAL</small><b>{dateString}</b><small>{draft.eventTime || "Waktu menyusul"} WIB</small></span></div><a className="public-scroll-link" href="#detail-acara">LIHAT DETAIL ACARA <ArrowDown size={14} /></a></div><div className="public-preview-side">{preview}<div className="public-side-caption"><span>Made with <Heart size={12} fill="currentColor" /> by TamuKita</span><span>{slug}</span></div></div></div>
      <section className="public-countdown-section"><div className="public-countdown"><span>HARI YANG KAMI NANTIKAN</span><div><b>{countdown.days}<small>hari</small></b><i>:</i><b>{String(countdown.hours).padStart(2, "0")}<small>jam</small></b><i>:</i><b>{String(countdown.minutes).padStart(2, "0")}<small>menit</small></b><i>:</i><b>{String(countdown.seconds).padStart(2, "0")}<small>detik</small></b></div></div></section>
      <section className="public-detail-section" id="detail-acara"><div className="public-detail-inner"><span className="eyebrow">SIMPAN TANGGALNYA</span><h2>Sampai jumpa di hari <em>bahagia.</em></h2><div className="public-detail-cards"><div className="public-detail-card"><span className="detail-card-icon"><CalendarDays size={18} /></span><small>WAKTU</small><b>{dateString}</b><span>{draft.eventTime} WIB</span></div><div className="public-detail-card"><span className="detail-card-icon"><MapPin size={18} /></span><small>LOKASI</small><b>{draft.venue || "Lokasi acara"}</b><span>{draft.address}</span>{mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer">Buka peta <ArrowUpRight size={13} /></a>}</div></div>{isExample ? <span className="button button--outline" aria-disabled="true">Contoh undangan · RSVP nonaktif</span> : featureAccess.rsvp && <><button type="button" className="button button--dark" onClick={() => { setRsvpOpen(true); setSubmitted(false); setRsvpError(""); }}><Heart size={15} /> Konfirmasi kehadiran</button><span className="rsvp-count"><CheckCircle2 size={14} /> {rsvpCount > 0 ? `${rsvpCount} tamu telah mengirim RSVP` : "Jadilah yang pertama mengirim RSVP"}</span></>}</div></section>
      {featureAccess.galleryLimit > 0 && draft.galleryPhotos.slice(0, featureAccess.galleryLimit).length > 0 && <section className="public-gallery-section"><div className="public-gallery-inner"><span className="eyebrow">POTONGAN CERITA</span><h2>Momen yang ingin <em>kami kenang.</em></h2><div className="public-gallery-grid">{draft.galleryPhotos.slice(0, featureAccess.galleryLimit).map((photo, index) => <figure key={photo}><Image src={photo} alt={`Foto galeri ${index + 1} ${draft.eventKind.toLowerCase()}`} width={640} height={480} sizes="(max-width: 720px) 50vw, 33vw" unoptimized /></figure>)}</div></div></section>}
      {draft.giftBankName && draft.giftAccountName && draft.giftAccountNumber && <section className="public-gift-section"><div className="public-gift-card"><span className="detail-card-icon"><Gift size={18} /></span><span className="eyebrow">TANDA KASIH</span><h2>Kehadiranmu adalah <em>hadiah terindah.</em></h2><p>{draft.giftMessage || "Jika berkenan, kamu dapat mengirimkan tanda kasih melalui rekening berikut."}</p><div className="public-gift-account"><span>{draft.giftBankName}</span><b>{draft.giftAccountName}</b><strong>{draft.giftAccountNumber}</strong><button className="button button--outline button--small" type="button" onClick={() => void copyGiftAccount()}>{giftCopied ? <CheckCircle2 size={13} /> : <Copy size={13} />}{giftCopied ? "Tersalin" : "Salin nomor rekening"}</button></div></div></section>}
      {!isExample && <section className="public-guestbook-section">
        <div className="guestbook-inner">
          <div className="guestbook-heading"><span className="eyebrow">UCAPAN & DOA</span><h2>Kirimkan <em>doa terbaikmu.</em></h2><p>Ucapan akan tampil setelah disetujui oleh pengundang.</p></div>
          <form className="guestbook-form" onSubmit={submitGuestbook}>
            <label className="editor-field"><span className="field-label">Namamu</span><input className="text-input" required minLength={2} maxLength={100} value={guestbookName} onChange={(event) => setGuestbookName(event.target.value)} placeholder="Nama lengkap" /></label>
            <label className="editor-field"><span className="field-label">Ucapan</span><textarea className="text-input text-area" required minLength={2} maxLength={1000} rows={4} value={guestbookMessage} onChange={(event) => setGuestbookMessage(event.target.value)} placeholder="Tulis doa atau pesan untuk pengantin..." /></label>
            {guestbookError && <div className="editor-error" role="alert">{guestbookError}</div>}
            {guestbookSent && <p className="guestbook-success" role="status">Terima kasih. Ucapanmu menunggu persetujuan pengundang.</p>}
            <button className="button button--dark" type="submit" disabled={guestbookSending}>{guestbookSending ? "Mengirim..." : "Kirim ucapan"} <Send size={14} /></button>
          </form>
          <div className="guestbook-list" aria-live="polite">
            {guestbookEntries.length ? guestbookEntries.map((entry) => <article className="guestbook-entry" key={entry.id}>
              <span className="guestbook-heart"><Heart size={14} fill="currentColor" /></span>
              <div className="guestbook-entry-body">
                <h3>{entry.displayName}</h3>
                <p>{entry.message}</p>
                <time dateTime={entry.createdAt}>{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(entry.createdAt))}</time>
                {reportedEntryIds.includes(entry.id) ? <span className="guestbook-report-confirmation" role="status">Laporan diterima. Terima kasih sudah membantu menjaga ruang ini.</span> : <>
                  <button className="guestbook-report-trigger" type="button" aria-label="Laporkan ucapan" aria-expanded={reportingEntryId === entry.id} onClick={() => { setReportError(""); setReportingEntryId((current) => current === entry.id ? "" : entry.id); }}><Flag size={12} /> Laporkan</button>
                  {reportingEntryId === entry.id && <fieldset className="guestbook-report-form">
                    <legend className="field-label">Laporkan ucapan</legend>
                    <label className="editor-field"><span className="field-label">Alasan laporan</span><select className="text-input" aria-label="Alasan laporan" value={reportReason} onChange={(event) => setReportReason(event.target.value as ReportReason)}><option value="SPAM">Spam atau promosi</option><option value="HARASSMENT">Pelecehan atau ujaran menyerang</option><option value="PERSONAL_INFORMATION">Informasi pribadi</option><option value="OTHER">Alasan lainnya</option></select></label>
                    {reportError && <div className="editor-error" role="alert">{reportError}</div>}
                    <div className="guestbook-report-actions"><button className="button button--dark button--small" type="button" disabled={reportBusyId === entry.id} onClick={() => void submitGuestbookReport(entry.id)}>{reportBusyId === entry.id ? "Mengirim..." : "Kirim laporan"}</button><button className="button button--outline button--small" type="button" disabled={reportBusyId === entry.id} onClick={() => setReportingEntryId("")}>Batal</button></div>
                  </fieldset>}
                </>}
              </div>
            </article>) : <p className="guestbook-empty">Belum ada ucapan yang disetujui.</p>}
          </div>
        </div>
      </section>}
      <footer className="public-footer"><div><Sparkles size={14} /><span>Setiap momen layak diceritakan dengan indah.</span></div><a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><Send size={13} /> Bagikan undangan ini</a></footer>
      {rsvpOpen && <div className="modal-backdrop" role="presentation"><section className="rsvp-modal" role="dialog" aria-modal="true" aria-labelledby="rsvp-title"><button type="button" className="modal-close" onClick={() => setRsvpOpen(false)} aria-label="Tutup"><X size={18} /></button>{submitted ? <div className="rsvp-confirmation"><span><CheckCircle2 size={28} /></span><h2>Terima kasih, {guestName}!</h2><p>Konfirmasimu sudah dicatat untuk undangan ini. Kami tunggu kehadiranmu.</p><button type="button" className="button button--dark" onClick={() => setRsvpOpen(false)}>Selesai</button></div> : <><span className="eyebrow">KABAR BAIK UNTUK KAMI</span><h2 id="rsvp-title">Kamu bisa hadir?</h2><p className="rsvp-modal-intro">Beri tahu kami agar persiapan hari bahagia jadi lebih mudah.</p><form onSubmit={submitRSVP}>{guestToken ? <div className="editor-field"><span className="field-label">Undangan untuk</span><input className="text-input" aria-label="Undangan untuk" value={guestName} readOnly /></div> : <label className="editor-field"><span className="field-label">Nama lengkap</span><input className="text-input" required maxLength={100} value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Nama kamu" /></label>}<div className="rsvp-options"><button type="button" className={attendance === "Hadir" ? "is-selected" : ""} onClick={() => setAttendance("Hadir")}>Dengan senang hati hadir</button><button type="button" className={attendance === "Berhalangan" ? "is-selected" : ""} onClick={() => setAttendance("Berhalangan")}>Mohon maaf berhalangan</button></div>{attendance === "Hadir" && <label className="editor-field"><span className="field-label">Jumlah tamu yang hadir</span><select className="text-input" value={attendeeCount} onChange={(event) => setAttendeeCount(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} orang</option>)}</select></label>}{rsvpError && <div className="editor-error" role="alert">{rsvpError}</div>}<button className="button button--dark button--wide" type="submit">Kirim konfirmasi <Send size={15} /></button><small className="rsvp-demo-note"><Music2 size={12} /> Pengundang akan menerima email konfirmasi bila alamat emailnya tersedia.</small></form></>}</section></div>}
    </main>
  );
}
