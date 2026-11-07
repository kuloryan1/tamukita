"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import Image from "next/image";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, Copy, Gift, Heart, LayoutGrid, Mail, MapPin, RotateCcw, Share2, Users, X } from "lucide-react";
import { BotanicalCorner, BotanicalWreath, SatinBow, TinyFlourish } from "@/components/stationery-ornaments";
import { RSVP } from "@/components/stationery-demo-rsvp";
import { PublicInvitationGiftCopy } from "@/components/public-invitation-actions";
import { InvitationPaparazzi } from "@/components/invitation-paparazzi";
import { invitationGiftAccounts, safeHttpsUrl, type InvitationDraft } from "@/lib/invitations";
import { templates, WEDDING, type WeddingTemplate } from "@/lib/stationery-demo";
import { MAX_RECIPIENT_LENGTH, normalizeRecipient } from "@/lib/stationery-recipient";

function Monogram({ small = false, hostOne = WEDDING.groom, hostTwo = WEDDING.bride }: { small?: boolean; hostOne?: string; hostTwo?: string }) {
  const firstInitial = (name: string) => Array.from(name.trim())[0]?.toLocaleUpperCase("id-ID") ?? "?";
  return <div className={`monogram${small ? " monogram-small" : ""}`} role="img" aria-label={`${hostOne} dan ${hostTwo}`}><BotanicalWreath /><span>{firstInitial(hostOne)}<span className="monogram-amp">&</span>{firstInitial(hostTwo)}</span></div>;
}

function Countdown({ targetDate, accessibleDate }: { targetDate: string; accessibleDate: string }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setRemaining(Math.max(0, new Date(targetDate).getTime() - Date.now()));
    update(); const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [targetDate]);
  const values = remaining === null ? [null, null, null, null] : [Math.floor(remaining / 86400000), Math.floor(remaining / 3600000) % 24, Math.floor(remaining / 60000) % 60, Math.floor(remaining / 1000) % 60];
  return <section className="countdown-section" aria-label="Hitung mundur menuju acara">
    <p className="eyebrow">{remaining === 0 ? "HARI BAHAGIA TELAH TIBA" : "MENGHITUNG HARI MENUJU BAHAGIA"}</p>
    <div className="countdown" role="timer" aria-label={`Waktu tersisa hingga ${accessibleDate}`}>
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

export function StationeryInvitation({ template, recipient, isTestableSample = false, slug, guestToken, paparazziToken, paparazziOpen = false, draft }: {
  template: WeddingTemplate;
  recipient: string;
  isTestableSample?: boolean;
  slug?: string;
  guestToken?: string;
  paparazziToken?: string;
  paparazziOpen?: boolean;
  draft?: InvitationDraft;
}) {
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const [activeSection, setActiveSection] = useState("undangan");
  const mainRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openingTimeout = useRef<number | null>(null);
  const guest = normalizeRecipient(recipient);
  const hostOne = draft?.hostOne || WEDDING.groom;
  const hostTwo = draft?.hostTwo || WEDDING.bride;
  const firstInitial = (name: string) => Array.from(name.trim())[0]?.toLocaleUpperCase("id-ID") ?? "?";
  const eventDate = draft?.eventDate || WEDDING.eventDate;
  const eventTime = draft?.eventTime || WEDDING.eventTime;
  const eventDateTime = new Date(`${eventDate}T${eventTime}:00+07:00`);
  const dateLabel = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(eventDateTime);
  const dateParts = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).formatToParts(eventDateTime);
  const datePart = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((part) => part.type === type)?.value ?? "";
  const dateHeading = { weekday: datePart("weekday").toLocaleUpperCase("id-ID"), day: datePart("day"), month: datePart("month").toLocaleUpperCase("id-ID"), year: datePart("year"), monthNumber: eventDate.slice(5, 7) };
  const eventTimeLabel = `${eventTime} WIB`;
  const eventTitle = draft?.eventTitle || "Undangan Pernikahan";
  const venue = draft?.venue || WEDDING.venue;
  const city = draft?.address || WEDDING.city;
  const intro = draft?.story || WEDDING.intro;
  const eventSchedule = draft?.eventSchedule ?? WEDDING.eventSchedule;
  const galleryPhotos = draft?.galleryPhotos ?? [];
  const coverPositionX = draft?.coverPositionX ?? 50;
  const coverPositionY = draft?.coverPosition ?? 50;
  const hostOneCoverPhotoPosition = `${Math.max(0, coverPositionX - 35)}% ${coverPositionY}%`;
  const hostTwoCoverPhotoPosition = `${Math.min(100, coverPositionX + 35)}% ${coverPositionY}%`;
  const giftAccounts = draft ? invitationGiftAccounts(draft) : [];
  const giftMessage = draft?.giftMessage || "Jika berkenan, Anda dapat mengirimkan tanda kasih melalui rekening berikut.";
  const mapQuery = [venue, city].filter(Boolean).join(", ");
  const mapUrl = safeHttpsUrl(draft?.mapsUrl ?? "") || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const eventStartsAt = `${eventDate}T${eventTime}:00+07:00`;
  const shareBasePath = isTestableSample && slug ? `/${encodeURIComponent(slug)}` : `/templates/${template.slug}/demo`;
  const recipientQuery = guest === "Anda" ? "" : `?to=${encodeURIComponent(guest)}`;
  const catalogUrl = `/templates${recipientQuery}`;
  const style = { "--paper": template.paper, "--ink": template.ink, "--muted": template.muted, "--accent": template.accent, "--line": template.line, "--scene": template.background } as CSSProperties;
  const framedPortrait = (name: string, parents: string, position: string, placement: string, horizontalOffset: string) => (
    <figure className={`cover-photo-tile ${placement}`} aria-label={`Potret ${name}`}>
      <div className="cover-photo-frame">
        <div className="cover-photo-window">
          <Image
            className="cover-photo-image"
            src={draft?.coverPhoto ?? ""}
            alt={`Potret ${name}`}
            width={1600}
            height={1000}
            sizes="(max-width: 640px) 33vw, 340px"
            unoptimized
            style={{ objectPosition: position, "--portrait-offset-x": horizontalOffset } as CSSProperties}
          />
        </div>
        <Image
          className="cover-photo-ornament"
          src="/images/frames/rococo-silver-oval-v2.png"
          alt=""
          aria-hidden="true"
          width={1254}
          height={1254}
          sizes="(max-width: 640px) 33vw, 340px"
        />
      </div>
      <figcaption className="cover-photo-caption">
        <h3>{name}</h3>
        {parents.trim() && <div className="cover-photo-parents"><span>Nama orang tua</span><p>{parents}</p></div>}
      </figcaption>
    </figure>
  );

  useEffect(() => {
    let scrollTimer: number | null = null;
    const revealHashTarget = () => {
      const hash = window.location.hash.slice(1);
      if (!["undangan", "detail-acara", "konfirmasi", "hadiah"].includes(hash)) return;
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
    ["undangan", "detail-acara", "konfirmasi", "hadiah"].forEach((id) => { const element = document.getElementById(id); if (element) observer.observe(element); });
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
      <a className="wordmark" href={catalogUrl} aria-label={`Undangan ${hostOne} dan ${hostTwo}`}><span className="wordmark-initials">{firstInitial(hostOne)}<span>&</span>{firstInitial(hostTwo)}</span><span className="wordmark-label">UNDANGAN<br />{draft?.eventKind && draft.eventKind !== "Pernikahan" ? eventTitle.toLocaleUpperCase("id-ID") : "PERNIKAHAN"}</span></a>
      <div className="header-actions"><a className="catalog-link" href={catalogUrl}><LayoutGrid size={15} /><span>Semua template</span></a><button type="button" className="icon-button share-trigger" aria-label="Bagikan undangan" onClick={() => dialogRef.current?.showModal()}><Share2 size={16} /></button></div>
    </header>

    {!opened ? <main className={`cover-stage${opening ? " is-opening" : ""}`}>
      <div className="stage-caption"><span className="eyebrow">SEBUAH UNDANGAN DARI HATI</span><span className="edition-mark">{dateHeading.day} · {dateHeading.monthNumber} · {dateHeading.year}</span></div>
      <div className="invitation-cover paper">
        <div className="paper-border" /><BotanicalCorner className="cover-botanical corner-top" variant={template.ornament} /><BotanicalCorner className="cover-botanical corner-bottom" variant={template.ornament} /><div className="cover-bow"><SatinBow /></div>
        <div className="cover-content"><Monogram hostOne={hostOne} hostTwo={hostTwo} /><p className="eyebrow cover-eyebrow">{draft?.eventKind && draft.eventKind !== "Pernikahan" ? eventTitle.toLocaleUpperCase("id-ID") : "HARI YANG KAMI NANTIKAN"}</p>
          <h1 className="cover-names"><span>{hostOne}</span><span className="name-amp">&</span><span>{hostTwo}</span></h1>
          <div className="cover-date"><span className="fine-rule" /><p>{dateLabel}</p><span className="fine-rule" /></div>
          <div className="recipient"><p>Kepada Yth.</p><strong>{guest}</strong></div>
          <button type="button" id="open-invitation" className="button primary open-button" onClick={openInvitation} disabled={opening}><Mail size={16} strokeWidth={1.5} /><span>{opening ? "Membuka undangan…" : "Buka undangan"}</span><ArrowRight size={15} /></button>
          <span className="cover-footnote">Dengan penuh sukacita, kami mengundang Anda.</span>
        </div>
      </div>
      <div className="cover-bottom"><span className="template-label"><span className="tiny-diamond" />{template.name}</span><label className="theme-selector">Pilih desain<select aria-label="Pilih template undangan" value={template.slug} onChange={(e) => window.location.assign(`/templates/${e.target.value}/demo${recipientQuery}`)}>{templates.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}</select></label></div>
      <noscript>Aktifkan JavaScript untuk membuka undangan. Acara: {dateLabel}, {eventTimeLabel}, {venue}.</noscript>
    </main> : <>
      <main className="opened-invitation" ref={mainRef} tabIndex={-1}>
        <section className="invitation-hero paper" id="undangan" aria-labelledby="invitation-heading">
          <div className="paper-border" /><BotanicalCorner className="hero-botanical corner-top" variant={template.ornament} /><BotanicalCorner className="hero-botanical corner-bottom" variant={template.ornament} /><Monogram small hostOne={hostOne} hostTwo={hostTwo} />
          <p className="eyebrow">HARI YANG KAMI NANTIKAN</p><h1 id="invitation-heading">Dengan penuh sukacita,<br />kami mengundang <em>Anda.</em></h1><TinyFlourish className="hero-flourish" />
          <div className="hero-names"><span>{hostOne}</span><span className="name-amp">&</span><span>{hostTwo}</span></div>
          <p className="invitation-message">{intro}</p>
          <div className="hero-date"><span className="eyebrow">HARI & TANGGAL</span><p>{dateLabel}</p><span>{eventTimeLabel}</span></div>
          <a className="detail-link" href="#detail-acara">LIHAT DETAIL ACARA <ArrowDown size={15} /></a>
        </section>
        {draft?.coverPhoto && (
          <section className="cover-photo-section" aria-label={`Foto ${hostOne} dan ${hostTwo}`}>
            <div className="cover-photo-stage">
              <div className="cover-photo-grid">
                {framedPortrait(hostTwo, draft?.hostTwoParents ?? "", hostTwoCoverPhotoPosition, "cover-photo-tile--host-two", "-13.2%")}
                {framedPortrait(hostOne, draft?.hostOneParents ?? "", hostOneCoverPhotoPosition, "cover-photo-tile--host-one", "9.9%")}
              </div>
            </div>
          </section>
        )}
        <Countdown targetDate={eventStartsAt} accessibleDate={`${dateLabel} pukul ${eventTime} WIB`} />
        <section className="event-section content-section" id="detail-acara" aria-labelledby="event-title">
          <div className="section-heading"><span className="eyebrow">SIMPAN TANGGALNYA</span><h2 id="event-title">Sampai jumpa di<br />hari <em>bahagia.</em></h2><TinyFlourish className="section-flourish" /></div>
          <div className="event-grid">
            <article className="event-card"><CalendarDays size={25} strokeWidth={1.1} /><span className="eyebrow">HARI & TANGGAL</span><div className="date-composition"><span className="date-weekday">{dateHeading.weekday}</span><strong>{dateHeading.day}</strong><span className="date-month">{dateHeading.month}<br />{dateHeading.year}</span></div><p className="event-time"><Clock3 size={15} />{eventTimeLabel}</p><a className="button secondary" href="/api/templates/demo/calendar" download="Ryan-Dwi-21-November-2026.ics">Simpan ke kalender <ArrowDown size={15} /></a></article>
            <article className="event-card venue-card"><MapPin size={25} strokeWidth={1.1} /><span className="eyebrow">LOKASI ACARA</span><h3>{venue}</h3><p>{city}</p><div className="venue-rule"><span /><Heart size={14} strokeWidth={1} /><span /></div><a className="button secondary" href={mapUrl} target="_blank" rel="noopener noreferrer">Buka peta <ArrowUpRight size={16} /></a></article>
          </div>
          {eventSchedule.length > 0 && <section className="event-rundown" aria-labelledby="event-rundown-title"><div className="event-rundown-heading"><span className="eyebrow">RANGKAIAN ACARA</span><h3 id="event-rundown-title">Rundown acara</h3><p>Setiap momen istimewa telah kami siapkan.</p></div><ol>{eventSchedule.filter((item) => item.time.trim() && item.title.trim()).map((item, index) => <li key={item.id}><time dateTime={item.time}>{item.time}<small>WIB</small></time><span className="event-rundown-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div className="event-rundown-content"><b>{item.title}</b>{item.description && <p>{item.description}</p>}</div></li>)}</ol></section>}
          <a className="text-link rsvp-jump" href="#konfirmasi">Konfirmasi kehadiran <ArrowDown size={15} /></a>
        </section>
        {paparazziToken && <InvitationPaparazzi token={paparazziToken} isOpen={paparazziOpen} />}
        {galleryPhotos.length > 0 && <section className="event-gallery-section" aria-label={`Galeri foto ${hostOne} dan ${hostTwo}`}><div className="event-gallery-heading"><span className="eyebrow">POTONGAN CERITA</span><h2>Momen yang ingin <em>kami kenang.</em></h2></div><div className="event-gallery-grid">{galleryPhotos.slice(0, 6).map((photo, index) => <figure key={photo}><Image src={photo} alt={`Foto ${index + 1} ${hostOne} dan ${hostTwo}`} width={640} height={480} sizes="(max-width: 720px) 50vw, 33vw" unoptimized /></figure>)}</div></section>}
        <RSVP template={template} recipient={guest} isTestableSample={isTestableSample} slug={slug} guestToken={guestToken} />
        {giftAccounts.length > 0 && <section className="gift-section content-section" id="hadiah" aria-labelledby="gift-title"><div className="section-heading"><Gift size={20} strokeWidth={1.2} /><span className="eyebrow">TANDA KASIH</span><h2 id="gift-title">Kehadiranmu adalah<br /><em>hadiah terindah.</em></h2></div><p className="gift-message">{giftMessage}</p><div className="gift-account-grid">{giftAccounts.map((account) => <article className="gift-account-card" key={account.id}><span className="gift-account-recipient">{account.recipientLabel}</span><span className="eyebrow">{account.bankName}</span><b>{account.accountName}</b><strong>{account.accountNumber}</strong><PublicInvitationGiftCopy accountNumber={account.accountNumber} /></article>)}</div></section>}
        <section className="closing-section paper"><BotanicalCorner className="closing-botanical" variant={template.ornament} /><TinyFlourish className="section-flourish" /><span className="eyebrow">DENGAN PENUH SUKACITA</span><h2>Hari istimewa ini,<br />lebih indah bersama <em>Anda.</em></h2><p>{intro}</p><div className="closing-names">{hostOne.split(" ")[0]} <em>&</em> {hostTwo.split(" ")[0]}</div><span className="closing-date">{dateLabel.toLocaleUpperCase("id-ID")}</span><button type="button" className="text-link" onClick={() => dialogRef.current?.showModal()}>Bagikan undangan <Share2 size={14} /></button></section>
      </main>
      <footer className="site-footer"><a href={catalogUrl}><ArrowLeft size={14} />Koleksi template</a><span>{template.name} · {hostOne} & {hostTwo}</span><button type="button" onClick={reopenCover}><RotateCcw size={13} />Lihat sampul</button></footer>
      <nav className="bottom-nav" aria-label="Navigasi undangan" style={{ gridTemplateColumns: `repeat(${giftAccounts.length > 0 ? 4 : 3}, minmax(0, 1fr))` }}>{[{ id: "undangan", text: "Undangan", Icon: Mail }, { id: "detail-acara", text: "Acara", Icon: CalendarDays }, { id: "konfirmasi", text: "Kehadiran", Icon: Users }, ...(giftAccounts.length > 0 ? [{ id: "hadiah", text: "Hadiah", Icon: Gift }] : [])].map(({ id, text, Icon }) => <a href={`#${id}`} key={id} aria-current={activeSection === id ? "location" : undefined} className={activeSection === id ? "active" : ""}><Icon size={17} strokeWidth={1.5} /><span>{text}</span></a>)}</nav>
    </>}
    <ShareDialog dialogRef={dialogRef} recipient={guest} basePath={shareBasePath} />
  </div>;
}
