"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, Copy, Heart, LayoutGrid, Mail, MapPin, RotateCcw, Share2, Users, X } from "lucide-react";
import { BotanicalCorner, BotanicalWreath, SatinBow, TinyFlourish } from "@/components/stationery-ornaments";
import { RSVP } from "@/components/stationery-demo-rsvp";
import { templates, WEDDING, type WeddingTemplate } from "@/lib/stationery-demo";
import { MAX_RECIPIENT_LENGTH, normalizeRecipient } from "@/lib/stationery-recipient";

const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${WEDDING.venue}, ${WEDDING.city}`)}`;

function Monogram({ small = false }: { small?: boolean }) {
  return <div className={`monogram${small ? " monogram-small" : ""}`} role="img" aria-label="Ryan dan Dwi"><BotanicalWreath /><span>R<span className="monogram-amp">&</span>D</span></div>;
}

function Countdown() {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, new Date(WEDDING.startAt).getTime() - Date.now()));
    update(); const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);
  const values = remaining === null ? [null, null, null, null] : [Math.floor(remaining / 86400000), Math.floor(remaining / 3600000) % 24, Math.floor(remaining / 60000) % 60, Math.floor(remaining / 1000) % 60];
  return <section className="countdown-section" aria-label="Hitung mundur menuju acara">
    <p className="eyebrow">{remaining === 0 ? "HARI BAHAGIA TELAH TIBA" : "MENGHITUNG HARI MENUJU BAHAGIA"}</p>
    <div className="countdown" role="timer" aria-label="Waktu tersisa hingga 21 November 2026 pukul 18.00 WIB">
      {values.map((value, i) => <div className="countdown-unit" key={["Hari", "Jam", "Menit", "Detik"][i]}><span className="countdown-number">{value === null ? "—" : String(value).padStart(2, "0")}</span><span className="countdown-label">{["Hari", "Jam", "Menit", "Detik"][i]}</span></div>)}
    </div><span className="countdown-timezone">Waktu Indonesia Barat</span>
  </section>;
}

function ShareDialog({ dialogRef, recipient, basePath }: { dialogRef: RefObject<HTMLDialogElement | null>; recipient: string; basePath: string }) {
  const normalizedRecipient = normalizeRecipient(recipient);
  const [to, setTo] = useState(normalizedRecipient === "Anda" ? "" : normalizedRecipient);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const sharedRecipient = normalizeRecipient(to, "");
  const url = `${origin}${basePath}${sharedRecipient ? `?to=${encodeURIComponent(sharedRecipient)}` : ""}`;
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setCopyError(false); }
    catch { setCopyError(true); }
  }
  return <dialog className="share-dialog" ref={dialogRef} aria-labelledby="share-title" onKeyDown={(event) => { if (event.key === "Escape") dialogRef.current?.close(); }} onClick={(e) => { if (e.target === e.currentTarget) dialogRef.current?.close(); }}>
    <div className="share-dialog-content">
      <button type="button" className="icon-button dialog-close" aria-label="Tutup bagikan undangan" onClick={() => dialogRef.current?.close()}><X size={19} /></button>
      <span className="eyebrow">UNTUK ORANG TERISTIMEWA</span><h2 id="share-title">Sebuah undangan,<br /><em>khusus untuk Anda.</em></h2>
      <label htmlFor="share-recipient">Nama penerima</label><input id="share-recipient" value={to} maxLength={MAX_RECIPIENT_LENGTH * 2} onChange={(e) => { setTo(e.target.value); setCopied(false); setCopyError(false); }} onBlur={(e) => setTo(normalizeRecipient(e.target.value, ""))} placeholder="Contoh: Bapak Budi & Ibu Sari" />
      <p className="share-help">Nama ini akan tampil pada sampul undangan saat tautannya dibuka.</p>
      <label htmlFor="share-url">Tautan demo undangan</label><input id="share-url" className="share-url" readOnly value={url} onFocus={(e) => e.target.select()} />
      <button type="button" className="button primary" onClick={copy}>{copied ? <><Check size={16} />Tautan disalin</> : <><Copy size={16} />Salin tautan</>}</button>
      {copyError && <p className="share-error" role="alert">Salin tautan secara manual dari kolom di atas.</p>}
      <a className="text-link" href={url} target="_blank" rel="noopener noreferrer">Lihat sebagai penerima <ArrowUpRight size={15} /></a>
      <div role="status" className="sr-only">{copied ? "Tautan undangan berhasil disalin." : ""}</div>
    </div>
  </dialog>;
}

export function StationeryInvitation({ template, recipient, isTestableSample = false, slug, guestToken }: {
  template: WeddingTemplate;
  recipient: string;
  isTestableSample?: boolean;
  slug?: string;
  guestToken?: string;
}) {
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const [activeSection, setActiveSection] = useState("undangan");
  const mainRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openingTimeout = useRef<number | null>(null);
  const guest = normalizeRecipient(recipient);
  const shareBasePath = isTestableSample && slug ? `/${encodeURIComponent(slug)}` : `/templates/${template.slug}/demo`;
  const recipientQuery = guest === "Anda" ? "" : `?to=${encodeURIComponent(guest)}`;
  const catalogUrl = `/templates${recipientQuery}`;
  const style = { "--paper": template.paper, "--ink": template.ink, "--muted": template.muted, "--accent": template.accent, "--line": template.line, "--scene": template.background } as CSSProperties;

  useEffect(() => {
    let scrollTimer: number | null = null;
    const revealHashTarget = () => {
      const hash = window.location.hash.slice(1);
      if (!["undangan", "detail-acara", "konfirmasi"].includes(hash)) return;
      if (scrollTimer !== null) window.clearTimeout(scrollTimer);
      if (openingTimeout.current !== null) {
        window.clearTimeout(openingTimeout.current);
        openingTimeout.current = null;
      }
      setOpening(false); setOpened(true); setActiveSection(hash);
      // Existing sections already receive native anchor navigation. Wait only
      // when the cover must be replaced before the target exists in the DOM.
      if (!document.getElementById(hash)) {
        scrollTimer = window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "instant" }), 80);
      }
    };
    revealHashTarget();
    window.addEventListener("hashchange", revealHashTarget);
    return () => {
      window.removeEventListener("hashchange", revealHashTarget);
      if (scrollTimer !== null) window.clearTimeout(scrollTimer);
    };
  }, []);
  useEffect(() => () => { if (openingTimeout.current !== null) window.clearTimeout(openingTimeout.current); }, []);
  useEffect(() => {
    if (!opened) return;
    const observer = new IntersectionObserver((entries) => { for (const entry of entries) if (entry.isIntersecting) setActiveSection(entry.target.id); }, { rootMargin: "-15% 0px -60% 0px", threshold: 0 });
    ["undangan", "detail-acara", "konfirmasi"].forEach((id) => { const element = document.getElementById(id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, [opened]);

  function openInvitation() {
    if (opening) return;
    setOpening(true);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    openingTimeout.current = window.setTimeout(() => { setOpened(true); setOpening(false); window.scrollTo({ top: 0, behavior: "instant" }); window.setTimeout(() => mainRef.current?.focus({ preventScroll: true }), 0); }, reduced ? 0 : 650);
  }
  function reopenCover() {
    setOpened(false); setActiveSection("undangan"); window.history.replaceState(null, "", window.location.pathname + window.location.search); window.scrollTo({ top: 0, behavior: "instant" });
  }

  return <div className={`stationery-demo theme-${template.slug} style-${template.style} ${opened ? "is-open" : "is-closed"}`} style={style} data-invitation-publication={isTestableSample ? "published" : "demo"} data-template={template.slug}>
    <a className="skip-link" href={opened ? "#detail-acara" : "#open-invitation"}>Lewati ke undangan</a>
    <header className="site-header">
      <a className="wordmark" href={catalogUrl} aria-label="Koleksi undangan Ryan dan Dwi"><span className="wordmark-initials">R<span>&</span>D</span><span className="wordmark-label">UNDANGAN<br />PERNIKAHAN</span></a>
      <div className="header-actions"><a className="catalog-link" href={catalogUrl}><LayoutGrid size={15} /><span>Semua template</span></a><button type="button" className="icon-button share-trigger" aria-label="Bagikan undangan" onClick={() => dialogRef.current?.showModal()}><Share2 size={16} /></button></div>
    </header>

    {!opened ? <main className={`cover-stage${opening ? " is-opening" : ""}`}>
      <div className="stage-caption"><span className="eyebrow">SEBUAH UNDANGAN DARI HATI</span><span className="edition-mark">21 · 11 · 2026</span></div>
      <div className="invitation-cover paper">
        <div className="paper-border" /><BotanicalCorner className="cover-botanical corner-top" variant={template.ornament} /><BotanicalCorner className="cover-botanical corner-bottom" variant={template.ornament} /><div className="cover-bow"><SatinBow /></div>
        <div className="cover-content"><Monogram /><p className="eyebrow cover-eyebrow">HARI YANG KAMI NANTIKAN</p>
          <h1 className="cover-names"><span>{WEDDING.groom}</span><span className="name-amp">&</span><span>{WEDDING.bride}</span></h1>
          <div className="cover-date"><span className="fine-rule" /><p>{WEDDING.dateLabel}</p><span className="fine-rule" /></div>
          <div className="recipient"><p>Kepada Yth.</p><strong>{guest}</strong></div>
          <button type="button" id="open-invitation" className="button primary open-button" onClick={openInvitation} disabled={opening}><Mail size={16} strokeWidth={1.5} /><span>{opening ? "Membuka undangan…" : "Buka undangan"}</span><ArrowRight size={15} /></button>
          <span className="cover-footnote">Dengan penuh sukacita, kami mengundang Anda.</span>
        </div>
      </div>
      <div className="cover-bottom"><span className="template-label"><span className="tiny-diamond" />{template.name}</span><label className="theme-selector">Pilih desain<select aria-label="Pilih template undangan" value={template.slug} onChange={(e) => window.location.assign(`/templates/${e.target.value}/demo${recipientQuery}`)}>{templates.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label></div>
      <noscript>Aktifkan JavaScript untuk membuka undangan interaktif. Acara: Sabtu, 21 November 2026, 18:00 WIB, Gedung Pariwisata Surabaya.</noscript>
    </main> : <>
      <main className="opened-invitation" ref={mainRef} tabIndex={-1}>
        <section className="invitation-hero paper" id="undangan" aria-labelledby="invitation-heading">
          <div className="paper-border" /><BotanicalCorner className="hero-botanical corner-top" variant={template.ornament} /><BotanicalCorner className="hero-botanical corner-bottom" variant={template.ornament} /><Monogram small />
          <p className="eyebrow">HARI YANG KAMI NANTIKAN</p><h1 id="invitation-heading">Dengan penuh sukacita,<br />kami mengundang <em>Anda.</em></h1><TinyFlourish className="hero-flourish" />
          <div className="hero-names"><span>{WEDDING.groom}</span><span className="name-amp">&</span><span>{WEDDING.bride}</span></div>
          <p className="invitation-message">{WEDDING.intro}</p>
          <div className="hero-date"><span className="eyebrow">HARI & TANGGAL</span><p>{WEDDING.dateLabel}</p><span>{WEDDING.timeLabel}</span></div>
          <a className="detail-link" href="#detail-acara">LIHAT DETAIL ACARA <ArrowDown size={15} /></a>
        </section>
        <Countdown />
        <section className="event-section content-section" id="detail-acara" aria-labelledby="event-title">
          <div className="section-heading"><span className="eyebrow">SIMPAN TANGGALNYA</span><h2 id="event-title">Sampai jumpa di<br />hari <em>bahagia.</em></h2><TinyFlourish className="section-flourish" /></div>
          <div className="event-grid">
            <article className="event-card"><CalendarDays size={25} strokeWidth={1.1} /><span className="eyebrow">HARI & TANGGAL</span><div className="date-composition"><span className="date-weekday">SABTU</span><strong>21</strong><span className="date-month">NOVEMBER<br />2026</span></div><p className="event-time"><Clock3 size={15} />{WEDDING.timeLabel}</p><a className="button secondary" href="/api/templates/demo/calendar" download="Ryan-Dwi-21-November-2026.ics">Simpan ke kalender <ArrowDown size={15} /></a></article>
            <article className="event-card venue-card"><MapPin size={25} strokeWidth={1.1} /><span className="eyebrow">LOKASI ACARA</span><h3>{WEDDING.venue}</h3><p>{WEDDING.city}</p><div className="venue-rule"><span /><Heart size={14} strokeWidth={1} /><span /></div><a className="button secondary" href={mapUrl} target="_blank" rel="noopener noreferrer">Buka peta <ArrowUpRight size={16} /></a></article>
          </div>
          <a className="text-link rsvp-jump" href="#konfirmasi">Konfirmasi kehadiran <ArrowDown size={15} /></a>
        </section>
        <RSVP template={template} recipient={guest} isTestableSample={isTestableSample} slug={slug} guestToken={guestToken} />
        <section className="closing-section paper"><BotanicalCorner className="closing-botanical" variant={template.ornament} /><TinyFlourish className="section-flourish" /><span className="eyebrow">DENGAN PENUH SUKACITA</span><h2>Hari istimewa ini,<br />lebih indah bersama <em>Anda.</em></h2><p>{WEDDING.intro}</p><div className="closing-names">Ryan <em>&</em> Dwi</div><span className="closing-date">21 NOVEMBER 2026</span><button type="button" className="text-link" onClick={() => dialogRef.current?.showModal()}>Bagikan undangan <Share2 size={14} /></button></section>
      </main>
      <footer className="site-footer"><a href={catalogUrl}><ArrowLeft size={14} />Koleksi template</a><span>{template.name} · Ryan & Dwi</span><button type="button" onClick={reopenCover}><RotateCcw size={13} />Lihat sampul</button></footer>
      <nav className="bottom-nav" aria-label="Navigasi undangan">{[{ id: "undangan", text: "Undangan", Icon: Mail }, { id: "detail-acara", text: "Acara", Icon: CalendarDays }, { id: "konfirmasi", text: "Kehadiran", Icon: Users }].map(({ id, text, Icon }) => <a href={`#${id}`} key={id} aria-current={activeSection === id ? "location" : undefined} className={activeSection === id ? "active" : ""}><Icon size={17} strokeWidth={1.5} /><span>{text}</span></a>)}</nav>
    </>}
    <ShareDialog dialogRef={dialogRef} recipient={guest} basePath={shareBasePath} />
  </div>;
}
