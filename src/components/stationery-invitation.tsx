"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { flushSync } from "react-dom";
import Image from "next/image";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, Clock3, Copy, Gift, Heart, LayoutGrid, Mail, MapPin, RotateCcw, Share2, Users, X } from "lucide-react";
import { BotanicalCorner, SatinBow, TinyFlourish } from "@/components/stationery-ornaments";
import { Monogram } from "@/components/stationery-monogram";
import { RSVP } from "@/components/stationery-demo-rsvp";
import { InvitationPaparazzi } from "@/components/invitation-paparazzi";
import { PublicInvitationGiftCopy, PublicInvitationGuestbook, PublicInvitationMusic } from "@/components/public-invitation-actions";
import { invitationCopy, type InvitationCopyKey } from "@/lib/invitation-copy";
import { MAX_INVITATION_GALLERY_PHOTOS } from "@/lib/invitation-features";
import { invitationGiftAccounts, safeHttpsUrl, type InvitationDraft } from "@/lib/invitations";
import { getAkadEventDetails } from "@/lib/akad-event";
import { normalizeSealMonogram } from "@/lib/seal-monogram";
import { templates, WEDDING, type WeddingTemplate } from "@/lib/stationery-demo";
import { MAX_RECIPIENT_LENGTH, normalizeRecipient } from "@/lib/stationery-recipient";
import { filterListedTemplates } from "@/lib/template-visibility";
import { useCreamParallax } from "@/components/use-cream-parallax";
import { useCreamReveal } from "@/components/use-cream-reveal";
import { CreamTypedHeadline } from "@/components/cream-typed-headline";

const listedStationeryTemplates = filterListedTemplates(templates);
const ELEGANT_CREAM_OPENING_VIDEO = "/templates/elegant-cream-envelope-v1.mp4";
const ELEGANT_CREAM_COUPLE_COVERS = new Set([
  "/qa-fixtures/couple-cover.webp",
  "/templates/elegant-cream/wulan-dan-ryan-couple.webp",
]);
const ENVELOPE_START_TIMEOUT_MS = 3_000;
const ENVELOPE_PLAY_TIMEOUT_MS = 7_000;
const ENVELOPE_HANDOFF_TIMEOUT_MS = 1_300;
const ENVELOPE_FALLBACK_TIMEOUT_MS = 1_100;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

type OpeningPhase = "idle" | "loading" | "playing" | "revealing" | "fallback";

function releaseOpeningVideo(video: HTMLVideoElement | null) {
  if (!video?.hasAttribute("src")) return;
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function playEnvelopeOpeningSound() {
  try {
    const context = new AudioContext();
    const duration = 1.05;
    const sampleCount = Math.round(context.sampleRate * duration);
    const buffer = context.createBuffer(1, sampleCount, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previousSample = 0;
    for (let index = 0; index < sampleCount; index += 1) {
      const whiteNoise = Math.random() * 2 - 1;
      previousSample = (previousSample + 0.028 * whiteNoise) / 1.028;
      samples[index] = previousSample * 5.5;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(650, context.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1_900, context.currentTime + 0.25);
    filter.frequency.exponentialRampToValueAtTime(950, context.currentTime + duration);
    filter.Q.value = 0.75;
    const volume = context.createGain();
    volume.gain.setValueAtTime(0.0001, context.currentTime);
    volume.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.11);
    volume.gain.exponentialRampToValueAtTime(0.025, context.currentTime + 0.36);
    volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    source.connect(filter).connect(volume).connect(context.destination);
    source.onended = () => { void context.close().catch(() => {}); };
    source.start(context.currentTime);
    source.stop(context.currentTime + duration);
    void context.resume().catch(() => { void context.close().catch(() => {}); });
  } catch {
    // The envelope animation and invitation still open if Web Audio is unavailable.
  }
}

const countdownUnits = ["Hari", "Jam", "Menit", "Detik"] as const;

function Countdown({ targetDate, accessibleDate, label, animate = false }: { targetDate: string; accessibleDate: string; label: string; animate?: boolean }) {
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  useEffect(() => {
    const target = Date.parse(targetDate);
    if (!Number.isFinite(target)) {
      setSecondsRemaining(null);
      return;
    }
    let timer: number | undefined;
    function update() {
      const distance = target - Date.now();
      setSecondsRemaining(Math.max(0, Math.ceil(distance / 1_000)));
      if (distance > 0) timer = window.setTimeout(update, distance % 1_000 || 1_000);
    }
    update();
    return () => window.clearTimeout(timer);
  }, [targetDate]);
  const values = secondsRemaining === null ? [] : [
    Math.floor(secondsRemaining / 86_400),
    Math.floor(secondsRemaining / 3_600) % 24,
    Math.floor(secondsRemaining / 60) % 60,
    secondsRemaining % 60,
  ];
  return (
    <section className="countdown-section" aria-label={label}>
      <p className="eyebrow">{label}</p>
      <div className="countdown" role="timer" aria-label={`${label}: ${accessibleDate}`}>
        {countdownUnits.map((unit, index) => {
          const display = values[index]?.toString().padStart(2, "0") ?? "—";
          return (
            <div className="countdown-unit" key={unit}>
              <span className="countdown-number" data-wide={display.length > 3 || undefined}>
                {animate ? <span className="countdown-digit" key={display}>{display}</span> : display}
              </span>
              <span className="countdown-label">{unit}</span>
            </div>
          );
        })}
      </div>
      <span className="countdown-timezone">Waktu Indonesia Barat</span>
    </section>
  );
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

export function StationeryInvitation({ template, recipient, isTestableSample = false, slug, guestToken, initialGuestbook = [], draft, paparazziToken, calendarHref = "/api/templates/demo/calendar" }: {
  template: WeddingTemplate;
  recipient: string;
  isTestableSample?: boolean;
  slug?: string;
  guestToken?: string;
  initialGuestbook?: { id: string; displayName: string; message: string; createdAt: string }[];
  draft?: InvitationDraft;
  paparazziToken?: string;
  calendarHref?: string;
}) {
  const monogramCrestSrc = template.slug === "elegant-cream" ? "/images/monograms/wr-crest-elegant-cream.png" : "/images/monograms/wr-crest.png";
  const [opened, setOpened] = useState(false);
  const [openingPhase, setOpeningPhase] = useState<OpeningPhase>("idle");
  const [playHeroIntro, setPlayHeroIntro] = useState(false);
  const opening = openingPhase !== "idle";
  const animatingCover = openingPhase === "playing" || openingPhase === "revealing";
  const [activeSection, setActiveSection] = useState("undangan");
  const mainRef = useRef<HTMLElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const galleryDialogRef = useRef<HTMLDialogElement>(null);
  const [activeGalleryPhoto, setActiveGalleryPhoto] = useState<number | null>(null);
  const musicContainerRef = useRef<HTMLDivElement>(null);
  const openingVideoRef = useRef<HTMLVideoElement>(null);
  const coverRef = useRef<HTMLDivElement>(null);
  const [openingBounds, setOpeningBounds] = useState<CSSProperties>({});
  const openingTimeout = useRef<number | undefined>(undefined);
  const openingComplete = useRef(false);
  const openingAttempt = useRef(0);
  const guest = normalizeRecipient(recipient);
  const copy = (key: InvitationCopyKey, fallback?: string) => draft ? invitationCopy(draft, key, fallback) : fallback ?? "";
  const hasEnvelopeOpening = template.slug === "elegant-cream";
  useCreamParallax(mainRef, opened && hasEnvelopeOpening);
  useCreamReveal(mainRef, opened && hasEnvelopeOpening);
  const hostOne = draft?.hostOne || WEDDING.groom;
  const hostTwo = draft?.hostTwo || WEDDING.bride;
  const isElegantCream = template.slug === "elegant-cream";
  const isWulanRyanSample = isTestableSample && template.slug === "elegant-cream" && slug === "wulan-dan-ryan";
  const [firstHeroName, secondHeroName] = isWulanRyanSample
    ? ["Wulan", "Ryan"]
    : [hostOne, hostTwo];
  const firstInitial = (name: string) => Array.from(name.trim())[0]?.toLocaleUpperCase("id-ID") ?? "?";
  const requestedMonogram = normalizeSealMonogram(draft?.sealMonogram);
  // Older sample drafts stored "RD" as a placeholder; keep their usual R&D initials.
  const customMonogram = requestedMonogram === "RD" ? "" : requestedMonogram;
  const eventDate = draft?.eventDate || WEDDING.eventDate;
  const eventTime = draft?.eventTime || WEDDING.eventTime;
  const eventDateTime = new Date(`${eventDate}T${eventTime}:00+07:00`);
  const akadEvent = getAkadEventDetails(template.slug, draft?.customFields);
  const hasAkadDate = Boolean(akadEvent);
  const dateLabel = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(eventDateTime);
  const dateParts = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).formatToParts(eventDateTime);
  const datePart = (type: Intl.DateTimeFormatPartTypes) => dateParts.find((part) => part.type === type)?.value ?? "";
  const dateHeading = { weekday: datePart("weekday").toLocaleUpperCase("id-ID"), day: datePart("day"), month: datePart("month").toLocaleUpperCase("id-ID"), year: datePart("year"), monthNumber: eventDate.slice(5, 7) };
  const eventTimeLabel = `${eventTime} WIB`;
  const eventTitle = draft?.eventTitle || "Undangan Pernikahan";
  const venue = draft?.venue || WEDDING.venue;
  const city = draft?.address || WEDDING.city;
  const intro = draft?.story ?? WEDDING.intro;
  const headline = copy("invitationHeadline", isWulanRyanSample ? "" : "Dengan penuh sukacita, kami mengundang Anda.");
  const coverMessage = copy("coverMessage", "Dengan penuh sukacita, kami mengundang Anda.");
  const eventSchedule = draft?.eventSchedule ?? WEDDING.eventSchedule;
  const galleryPhotos = draft?.galleryPhotos ?? [];
  const activeGalleryPhotoSrc = activeGalleryPhoto === null ? null : galleryPhotos[activeGalleryPhoto];
  const activeGalleryPhotoAlt = activeGalleryPhoto === null ? "" : `Foto ${activeGalleryPhoto + 1} ${hostOne} dan ${hostTwo}`;
  const coverPositionX = draft?.coverPositionX ?? 50;
  const coverPositionY = draft?.coverPosition ?? 50;
  const hostOneCoverPhotoPosition = `${Math.max(0, coverPositionX - 35)}% ${coverPositionY}%`;
  const hostTwoCoverPhotoPosition = `${Math.min(100, coverPositionX + 35)}% ${coverPositionY}%`;
  const giftAccounts = draft ? invitationGiftAccounts(draft) : [];
  const giftMessage = draft?.giftMessage || copy("giftSectionIntro", "Jika berkenan, Anda dapat mengirimkan tanda kasih melalui rekening berikut.");
  const showGiftMessage = !(isWulanRyanSample && giftMessage.trim() === "Data rekening ini hanya contoh untuk melihat tampilan fitur hadiah.");
  const savedClosingNames = copy("closingNames", isWulanRyanSample ? "Wulan & Ryan" : `${hostOne.split(" ")[0]} & ${hostTwo.split(" ")[0]}`);
  const closingNames = isWulanRyanSample && savedClosingNames.trim().toLocaleLowerCase("id-ID") === "ryan & wulan"
    ? "Wulan & Ryan"
    : savedClosingNames;
  const mapQuery = [venue, city].filter(Boolean).join(", ");
  const mapUrl = safeHttpsUrl(draft?.mapsUrl ?? "") || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;
  const eventStartsAt = `${eventDate}T${eventTime}:00+07:00`;
  const shareBasePath = isTestableSample && slug ? `/${encodeURIComponent(slug)}` : `/templates/${template.slug}/demo`;
  const recipientQuery = guest === "Anda" ? "" : `?to=${encodeURIComponent(guest)}`;
  const catalogUrl = `/templates${recipientQuery}`;
  const style = { "--paper": template.paper, "--ink": template.ink, "--muted": template.muted, "--accent": template.accent, "--line": template.line, "--scene": template.background } as CSSProperties;
  const framedPortrait = (name: string, parents: string, individualPhoto: string | undefined, position: string, placement: string, horizontalOffset: string) => {
    const photoUrl = individualPhoto || draft?.coverPhoto;
    const isCreamCoupleCover = hasEnvelopeOpening && !individualPhoto && ELEGANT_CREAM_COUPLE_COVERS.has(photoUrl ?? "");
    const photoClass = individualPhoto ? " cover-photo-image--individual" : isCreamCoupleCover ? " cover-photo-image--cream-sample" : "";
    return (
      <figure className={`cover-photo-tile ${placement}`} aria-label={`Potret ${name}`}>
        <div className="cover-photo-frame">
          <div className="cover-photo-window">
            {photoUrl && <Image
              className={`cover-photo-image${photoClass}`}
              src={photoUrl}
              alt={`Potret ${name}`}
              width={isCreamCoupleCover ? 1086 : 1600}
              height={isCreamCoupleCover ? 1448 : 1000}
              sizes="(max-width: 640px) 33vw, 340px"
              unoptimized
              style={photoClass ? undefined : { objectPosition: position, "--portrait-offset-x": horizontalOffset } as CSSProperties}
            />}
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
  };

  useEffect(() => {
    let scrollTimer: number | null = null;
    const revealHashTarget = () => {
      const hash = window.location.hash.slice(1);
      if (!["undangan", "detail-acara", "konfirmasi", "hadiah"].includes(hash)) return;
      if (scrollTimer !== null) window.clearTimeout(scrollTimer);
      window.clearTimeout(openingTimeout.current);
      openingTimeout.current = undefined;
      openingComplete.current = true;
      openingAttempt.current += 1;
      releaseOpeningVideo(openingVideoRef.current);
      setOpeningPhase("idle");
      setOpened(true);
      setActiveSection(hash);
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
  useEffect(() => {
    const video = hasEnvelopeOpening ? openingVideoRef.current : null;
    return () => {
      window.clearTimeout(openingTimeout.current);
      openingAttempt.current += 1;
      releaseOpeningVideo(video);
    };
  }, [hasEnvelopeOpening]);
  useEffect(() => {
    if (!opened || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => { for (const entry of entries) if (entry.isIntersecting) setActiveSection(entry.target.id); }, { rootMargin: "-15% 0px -60% 0px", threshold: 0 });
    ["undangan", "detail-acara", "konfirmasi", "hadiah"].forEach((id) => { const element = document.getElementById(id); if (element) observer.observe(element); });
    return () => observer.disconnect();
  }, [opened]);
  function revealInvitation(keepScroll = false) {
    openingComplete.current = true;
    openingAttempt.current += 1;
    window.clearTimeout(openingTimeout.current);
    openingTimeout.current = undefined;
    releaseOpeningVideo(openingVideoRef.current);
    setOpeningPhase("idle");
    setOpened(true);
    if (!keepScroll) window.scrollTo({ top: 0, behavior: "instant" });
    window.setTimeout(() => { if (!mainRef.current?.contains(document.activeElement)) mainRef.current?.focus({ preventScroll: true }); }, 0);
  }
  function finishEnvelopeOpening() {
    if (openingComplete.current || !openingVideoRef.current?.hasAttribute("src")) return;
    openingComplete.current = true;
    window.clearTimeout(openingTimeout.current);
    openingVideoRef.current?.pause();
    setOpened(true);
    setOpeningPhase("revealing");
    window.scrollTo({ top: 0, behavior: "instant" });
    const attempt = openingAttempt.current;
    openingTimeout.current = window.setTimeout(() => {
      if (openingAttempt.current === attempt) revealInvitation(true);
    }, ENVELOPE_HANDOFF_TIMEOUT_MS);
  }
  function startCoverFallback(attempt: number) {
    if (openingComplete.current || openingAttempt.current !== attempt) return;
    openingAttempt.current += 1;
    window.clearTimeout(openingTimeout.current);
    releaseOpeningVideo(openingVideoRef.current);
    setOpeningPhase("fallback");
    openingTimeout.current = window.setTimeout(revealInvitation, ENVELOPE_FALLBACK_TIMEOUT_MS);
  }
  function openInvitation() {
    if (opening || openingTimeout.current !== undefined) return;
    if (hasEnvelopeOpening) {
      const audio = musicContainerRef.current?.querySelector("audio");
      if (audio?.paused) void audio.play().catch(() => {});
      playEnvelopeOpeningSound();
    }
    if (!hasEnvelopeOpening) {
      if (window.matchMedia(REDUCED_MOTION_QUERY).matches) return revealInvitation();
      setOpeningPhase("playing");
      openingTimeout.current = window.setTimeout(revealInvitation, 650);
      return;
    }

    setPlayHeroIntro(true);
    openingComplete.current = false;
    const attempt = ++openingAttempt.current;
    const video = openingVideoRef.current;
    if (!video) return startCoverFallback(attempt);

    const bounds = coverRef.current?.getBoundingClientRect();
    // The open button explicitly starts the clip. Make it renderable within that gesture.
    flushSync(() => {
      if (bounds) setOpeningBounds({ "--cream-video-left": `${bounds.left}px`, "--cream-video-top": `${bounds.top}px`, "--cream-video-width": `${bounds.width}px`, "--cream-video-height": `${bounds.height}px` } as CSSProperties);
      setOpeningPhase("loading");
    });
    openingTimeout.current = window.setTimeout(() => startCoverFallback(attempt), ENVELOPE_START_TIMEOUT_MS);
    video.src = ELEGANT_CREAM_OPENING_VIDEO;
    void video.play().then(
      () => {
        if (openingComplete.current || openingAttempt.current !== attempt) return;
        window.clearTimeout(openingTimeout.current);
        setOpeningPhase("playing");
        openingTimeout.current = window.setTimeout(finishEnvelopeOpening, ENVELOPE_PLAY_TIMEOUT_MS);
      },
      () => startCoverFallback(attempt),
    );
  }
  function reopenCover() {
    openingAttempt.current += 1;
    window.clearTimeout(openingTimeout.current);
    openingTimeout.current = undefined;
    musicContainerRef.current?.querySelector("audio")?.pause();
    releaseOpeningVideo(openingVideoRef.current);
    openingComplete.current = false;
    setOpeningPhase("idle");
    setOpened(false);
    setPlayHeroIntro(false);
    setActiveSection("undangan");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return <div className={`stationery-demo theme-${template.slug} style-${template.style} ${opened ? "is-open" : "is-closed"}`} style={style} data-invitation-publication={isTestableSample ? "published" : "demo"} data-template={template.slug}>
    <a className="skip-link" href={opened ? "#detail-acara" : "#open-invitation"}>Lewati ke undangan</a>
    {!hasEnvelopeOpening && <header className="site-header">
      <a className="wordmark" href={catalogUrl} aria-label={`Undangan ${hostOne} dan ${hostTwo}`}><span className={`wordmark-initials${customMonogram ? " wordmark-initials--custom" : ""}`}>{customMonogram || <>{firstInitial(hostOne)}<span>&</span>{firstInitial(hostTwo)}</>}</span><span className="wordmark-label">UNDANGAN<br />{draft?.eventKind && draft.eventKind !== "Pernikahan" ? eventTitle.toLocaleUpperCase("id-ID") : "PERNIKAHAN"}</span></a>
      <div className="header-actions"><a className="catalog-link" href={catalogUrl}><LayoutGrid size={15} /><span>{copy("catalogLinkLabel", "Koleksi template")}</span></a><button type="button" className="icon-button share-trigger" aria-label={copy("shareActionLabel", "Bagikan undangan")} onClick={() => dialogRef.current?.showModal()}><Share2 size={16} /></button></div>
    </header>}

    {!opened ? <main className={`cover-stage${animatingCover ? " is-opening" : ""}${hasEnvelopeOpening ? " is-cream-envelope" : ""}${openingPhase === "fallback" ? " is-cream-fallback" : ""}`}>
      {!hasEnvelopeOpening && <div className="stage-caption"><span className="eyebrow">{copy("stageCaption", "SEBUAH UNDANGAN DARI HATI")}</span><span className="edition-mark">{dateHeading.day} · {dateHeading.monthNumber} · {dateHeading.year}</span></div>}
      {hasEnvelopeOpening ? <div className="cream-envelope-cover" ref={coverRef} onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && openingPhase === "fallback") revealInvitation();
      }}>
        <Image className="cream-envelope-cover-art" src="/templates/reference-prototypes/cream-envelope-poster.jpg" alt="" fill preload sizes="(max-width: 400px) calc(100vw - 40px), 360px" />
        <div className="cream-envelope-monogram"><Monogram small hostOne={hostOne} hostTwo={hostTwo} customMonogram={customMonogram} crestSrc={monogramCrestSrc} /></div>
        <div className="cream-envelope-cover-details">
          <div className="cream-envelope-cover-copy">
            <div className="recipient"><p>{copy("recipientGreeting", "Kepada Yth.")}</p><strong>{guest}</strong></div>
          </div>
          <button type="button" id="open-invitation" className="cream-envelope-open-button" onClick={openInvitation} disabled={opening}>{opening ? "Membuka undangan…" : copy("openingButtonLabel", "Buka undangan")}</button>
        </div>
      </div> : <div className="invitation-cover paper">
        <div className="paper-border" /><BotanicalCorner className="cover-botanical corner-top" variant={template.ornament} /><BotanicalCorner className="cover-botanical corner-bottom" variant={template.ornament} /><div className="cover-bow"><SatinBow /></div>
        <div className="cover-content"><Monogram hostOne={hostOne} hostTwo={hostTwo} customMonogram={customMonogram} crestSrc={monogramCrestSrc} /><p className="eyebrow cover-eyebrow">{copy("coverEyebrow", draft?.eventKind && draft.eventKind !== "Pernikahan" ? eventTitle.toLocaleUpperCase("id-ID") : "HARI YANG KAMI NANTIKAN")}</p>
          <h1 className="cover-names"><span>{hostOne}</span><span className="name-amp">&</span><span>{hostTwo}</span></h1>
          <div className="cover-date"><span className="fine-rule" /><p>{dateLabel}</p><span className="fine-rule" /></div>
          <div className="recipient"><p>{copy("recipientGreeting", "Kepada Yth.")}</p><strong>{guest}</strong></div>
          <button type="button" id="open-invitation" className="button primary open-button" onClick={openInvitation} disabled={opening}><Mail size={16} strokeWidth={1.5} /><span>{opening ? "Membuka undangan…" : copy("openingButtonLabel", "Buka undangan")}</span><ArrowRight size={15} /></button>
          {coverMessage && <span className="cover-footnote">{coverMessage}</span>}
        </div>
      </div>}
      {!hasEnvelopeOpening && <div className="cover-bottom">
        <span className="template-label"><span className="tiny-diamond" />{template.name}</span>
        {listedStationeryTemplates.length > 1 && (
          <label className="theme-selector">
            Pilih desain
            <select aria-label="Pilih template undangan" value={template.slug} onChange={(event) => window.location.assign(`/templates/${event.target.value}/demo${recipientQuery}`)}>
              {listedStationeryTemplates.map((item) => <option value={item.slug} key={item.slug}>{item.name}</option>)}
            </select>
          </label>
        )}
      </div>}
      <noscript>Aktifkan JavaScript untuk membuka undangan. Acara: {dateLabel}, {eventTimeLabel}, {venue}.</noscript>
    </main> : <>
      <main className="opened-invitation" ref={mainRef} tabIndex={-1} data-cream-intro={playHeroIntro ? (openingPhase === "revealing" ? "queued" : "running") : undefined}>
        <section className="invitation-hero paper" id="undangan" aria-labelledby={headline.trim() ? "invitation-heading" : undefined}>
          <div className="paper-border" /><BotanicalCorner className="hero-botanical corner-top" variant={template.ornament} /><BotanicalCorner className="hero-botanical corner-bottom" variant={template.ornament} /><Monogram small hostOne={hostOne} hostTwo={hostTwo} customMonogram={customMonogram} crestSrc={monogramCrestSrc} />
          <p className="eyebrow">{copy("invitationKicker", "HARI YANG KAMI NANTIKAN")}</p>
          {headline.trim() && <h1 id="invitation-heading" aria-label={playHeroIntro ? headline : undefined} style={{ whiteSpace: "pre-line" }}>
            {playHeroIntro ? <CreamTypedHeadline text={headline} /> : headline}
          </h1>}
          <TinyFlourish className="hero-flourish" />
          <div className={`hero-names${isWulanRyanSample ? " hero-names--wulan-ryan" : ""}`}><span>{firstHeroName}</span><span className="name-amp">&</span><span>{secondHeroName}</span></div>
          {intro.trim() && <p className="invitation-message">{intro}</p>}
          <div className="hero-date"><span className="eyebrow">{copy("eventDateLabel", "HARI & TANGGAL")}</span><p>{dateLabel}</p><span>{eventTimeLabel}</span></div>
          <a className="detail-link" href="#detail-acara">{copy("detailLinkLabel", "LIHAT DETAIL ACARA")} <ArrowDown size={15} /></a>
        </section>
        {(draft?.coverPhoto || draft?.hostOnePhoto || draft?.hostTwoPhoto) && (
          <section className="cover-photo-section" aria-label={`Foto ${hostOne} dan ${hostTwo}`}>
            <div className="cover-photo-stage">
              <div className="cover-photo-grid">
                {framedPortrait(hostTwo, draft?.hostTwoParents ?? "", draft?.hostTwoPhoto, hostTwoCoverPhotoPosition, "cover-photo-tile--host-two", "-13.2%")}
                {framedPortrait(hostOne, draft?.hostOneParents ?? "", draft?.hostOnePhoto, hostOneCoverPhotoPosition, "cover-photo-tile--host-one", "9.9%")}
              </div>
            </div>
          </section>
        )}
        <Countdown targetDate={eventStartsAt} accessibleDate={`${dateLabel} pukul ${eventTime} WIB`} label={copy("countdownLabel", "Menuju hari bahagia")} animate={hasEnvelopeOpening} />
        <section className="event-section content-section" id="detail-acara" aria-labelledby="event-title">
          <div className="section-heading"><span className="eyebrow">{copy("eventSectionEyebrow", "SIMPAN TANGGALNYA")}</span><h2 id="event-title" style={{ whiteSpace: "pre-line" }}>{copy("eventSectionHeading", "Sampai jumpa di hari bahagia.")}</h2><TinyFlourish className="section-flourish" /></div>
          <div className={`event-grid${hasAkadDate ? " event-grid--with-akad" : ""}${isElegantCream ? " event-grid--location-below" : ""}`}>
            {akadEvent && <article className="event-card akad-event-card"><CalendarDays size={25} strokeWidth={1.1} /><span className="eyebrow">AKAD NIKAH</span><div className="date-composition"><span className="date-weekday">{akadEvent.weekday}</span><strong>{akadEvent.day}</strong><span className="date-month">{akadEvent.month}<br />{akadEvent.year}</span></div>{akadEvent.time && <p className="event-time"><Clock3 size={15} />{akadEvent.time} WIB</p>}{akadEvent.address && <p className="akad-address">{akadEvent.address}</p>}</article>}
            <article className="event-card"><CalendarDays size={25} strokeWidth={1.1} /><span className="eyebrow">{copy("eventDateLabel", "HARI & TANGGAL")}</span><div className="date-composition"><span className="date-weekday">{dateHeading.weekday}</span><strong>{dateHeading.day}</strong><span className="date-month">{dateHeading.month}<br />{dateHeading.year}</span></div><p className="event-time"><Clock3 size={15} />{eventTimeLabel}</p><a className="button secondary" href={calendarHref} download>{copy("calendarActionLabel", "Simpan ke kalender")} <ArrowDown size={15} /></a></article>
            <article className="event-card venue-card">
              <MapPin size={25} strokeWidth={1.1} />
              <span className="eyebrow">{copy("locationLabel", "LOKASI ACARA")}</span>
              <h3>{venue}</h3>
              <p>{city}</p>
              <div className="venue-rule"><span /><Heart size={14} strokeWidth={1} /><span /></div>
              {isElegantCream && mapQuery && (
                <div className="venue-map-preview">
                  <iframe
                    title={`Peta lokasi ${venue || "acara"}`}
                    src={`https://www.google.com/maps?q=${encodeURIComponent(mapQuery)}&output=embed`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
              )}
              <a className="button secondary" href={mapUrl} target="_blank" rel="noopener noreferrer">{copy("mapActionLabel", "Buka peta")} <ArrowUpRight size={16} /></a>
            </article>
          </div>
          {eventSchedule.length > 0 && <section className="event-rundown" aria-labelledby="event-rundown-title"><div className="event-rundown-heading"><span className="eyebrow">{copy("scheduleSectionEyebrow", "RANGKAIAN ACARA")}</span><h3 id="event-rundown-title">{copy("scheduleSectionHeading", "Rundown acara")}</h3><p>{copy("scheduleSectionIntro", "Setiap momen istimewa telah kami siapkan.")}</p></div><ol>{eventSchedule.filter((item) => item.time.trim() && item.title.trim()).map((item, index) => <li key={item.id}><time dateTime={item.time}>{item.time}<small>WIB</small></time><span className="event-rundown-index" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span><div className="event-rundown-content"><b>{item.title}</b>{item.description && <p>{item.description}</p>}</div></li>)}</ol></section>}
          <a className="text-link rsvp-jump" href="#konfirmasi">{copy("rsvpJumpLabel", "Konfirmasi kehadiran")} <ArrowDown size={15} /></a>
        </section>
        {galleryPhotos.length > 0 && <section className="event-gallery-section" aria-label={`Galeri foto ${hostOne} dan ${hostTwo}`}>
          <div className="event-gallery-heading"><span className="eyebrow">{copy("gallerySectionEyebrow", "POTONGAN CERITA")}</span><h2 style={{ whiteSpace: "pre-line" }}>{copy("gallerySectionHeading", "Momen yang ingin kami kenang.")}</h2><p>{copy("gallerySectionIntro", "Foto-foto kenangan dari hari istimewa kami.")}</p></div>
          <div className="event-gallery-grid">{galleryPhotos.slice(0, isElegantCream ? MAX_INVITATION_GALLERY_PHOTOS : 6).map((photo, index) => {
            const imageAlt = `Foto ${index + 1} ${hostOne} dan ${hostTwo}`;
            const image = <Image src={photo} alt={imageAlt} width={640} height={480} sizes="(max-width: 720px) 50vw, 33vw" unoptimized />;
            return <figure key={photo}>{isElegantCream
              ? <button type="button" aria-haspopup="dialog" aria-label={`Perbesar ${imageAlt}`} onClick={() => {
                setActiveGalleryPhoto(index);
                galleryDialogRef.current?.showModal();
              }}>{image}</button>
              : image}</figure>;
          })}</div>
        </section>}
        {isElegantCream && galleryPhotos.length > 0 && <dialog className="share-dialog event-gallery-lightbox" ref={galleryDialogRef} aria-label={activeGalleryPhotoAlt || `Galeri foto ${hostOne} dan ${hostTwo}`} onClose={() => setActiveGalleryPhoto(null)} onClick={(event) => {
          if (event.target === event.currentTarget) galleryDialogRef.current?.close();
        }}>
          <div className="share-dialog-content event-gallery-lightbox-content">
            <button type="button" className="icon-button dialog-close" aria-label="Tutup foto" onClick={() => galleryDialogRef.current?.close()}><X size={19} /></button>
            {activeGalleryPhotoSrc && <Image className="event-gallery-lightbox-image" src={activeGalleryPhotoSrc} alt={activeGalleryPhotoAlt} width={640} height={480} sizes="100vw" unoptimized />}
          </div>
        </dialog>}
        {isTestableSample && isElegantCream && paparazziToken && <InvitationPaparazzi token={paparazziToken} />}
        <RSVP template={template} recipient={guest} isTestableSample={isTestableSample} slug={slug} guestToken={guestToken} copy={{ eyebrow: copy("rsvpSectionEyebrow", "KONFIRMASI KEHADIRAN"), heading: copy("rsvpSectionHeading", "Sebuah kabar, berarti bagi kami."), intro: copy("rsvpSectionIntro", "Isi konfirmasi kehadiran dan titipkan ucapan hangat untuk hari istimewa kami."), question: copy("rsvpFormQuestion", "Berkenan hadir?"), submit: copy("rsvpSubmitActionLabel", "Kirim konfirmasi") }} />
        {isTestableSample && isElegantCream && slug && <PublicInvitationGuestbook
          slug={slug}
          entries={initialGuestbook}
          recipientName={guest}
          guestToken={guestToken}
          entriesOnly
          copy={{ eyebrow: "UCAPAN & DOA", heading: "Doa baik untuk kami.", intro: "Ucapan yang disetujui pengundang akan tampil di sini." }}
        />}
        {giftAccounts.length > 0 && <section className="gift-section content-section" id="hadiah" aria-labelledby="gift-title"><div className="section-heading"><Gift size={20} strokeWidth={1.2} /><span className="eyebrow">{copy("giftSectionEyebrow", "TANDA KASIH")}</span><h2 id="gift-title" style={{ whiteSpace: "pre-line" }}>{copy("giftSectionHeading", "Kehadiranmu adalah hadiah terindah.")}</h2></div>{showGiftMessage && <p className="gift-message">{giftMessage}</p>}<div className="gift-account-grid">{giftAccounts.map((account) => <article className="gift-account-card" key={account.id}><span className="gift-account-recipient">{account.recipientLabel}</span><span className="eyebrow">{account.bankName}</span><b>{account.accountName}</b><strong>{account.accountNumber}</strong><PublicInvitationGiftCopy accountNumber={account.accountNumber} label={copy("giftCopyActionLabel", "Salin nomor rekening")} /></article>)}</div></section>}
        <section className="closing-section paper"><BotanicalCorner className="closing-botanical" variant={template.ornament} /><TinyFlourish className="section-flourish" /><span className="eyebrow">{copy("closingSectionEyebrow", "DENGAN PENUH SUKACITA")}</span><h2 style={{ whiteSpace: "pre-line" }}>{copy("closingSectionHeading", "Hari istimewa ini, lebih indah bersama Anda.")}</h2>{intro.trim() && <p>{intro}</p>}<div className="closing-names" style={{ whiteSpace: "pre-line" }}>{closingNames}</div><span className="closing-date">{dateLabel.toLocaleUpperCase("id-ID")}</span><button type="button" className="text-link" onClick={() => dialogRef.current?.showModal()}>{copy("shareActionLabel", "Bagikan undangan")} <Share2 size={14} /></button></section>
      </main>
      <footer className="site-footer"><a href={catalogUrl}><ArrowLeft size={14} />{copy("catalogLinkLabel", "Koleksi template")}</a><span>{template.name} · {hostOne} & {hostTwo}</span><button type="button" onClick={reopenCover}><RotateCcw size={13} />{copy("reopenCoverLabel", "Lihat sampul")}</button></footer>
      <nav className="bottom-nav" aria-label="Navigasi undangan" style={{ gridTemplateColumns: `repeat(${giftAccounts.length > 0 ? 4 : 3}, minmax(0, 1fr))` }}>{[{ id: "undangan", text: copy("navInvitationLabel", "Undangan"), Icon: Mail }, { id: "detail-acara", text: copy("navEventLabel", "Acara"), Icon: CalendarDays }, { id: "konfirmasi", text: copy("navRsvpLabel", "Kehadiran"), Icon: Users }, ...(giftAccounts.length > 0 ? [{ id: "hadiah", text: copy("navGiftLabel", "Hadiah"), Icon: Gift }] : [])].map(({ id, text, Icon }) => <a href={`#${id}`} key={id} aria-current={activeSection === id ? "location" : undefined} className={activeSection === id ? "active" : ""}><Icon size={17} strokeWidth={1.5} /><span>{text}</span></a>)}</nav>
    </>}
    {hasEnvelopeOpening && <section className={`cover-opening-overlay${openingPhase === "loading" ? " is-loading" : ""}${openingPhase === "revealing" ? " is-revealing" : ""}`} style={openingBounds} hidden={!opening || openingPhase === "fallback"} aria-label="Animasi pembukaan amplop" onTransitionEnd={(event) => {
      if (event.target === event.currentTarget && event.propertyName === "opacity" && openingPhase === "revealing") revealInvitation(true);
    }}>
      <span className="sr-only" role="status">Membuka amplop undangan.</span>
      <video ref={openingVideoRef} className="cover-opening-video" width={540} height={960} muted playsInline preload="none" disablePictureInPicture aria-hidden="true" tabIndex={-1} onEnded={finishEnvelopeOpening} onError={(event) => {
        if (event.currentTarget.error && event.currentTarget.hasAttribute("src")) startCoverFallback(openingAttempt.current);
      }}>Video pembukaan amplop Elegant Cream.</video>
    </section>}
    {draft?.musicUrl && <div className="stationery-music" ref={musicContainerRef} hidden={!opened}><PublicInvitationMusic src={draft.musicUrl} title={draft.musicTitle} startAtSeconds={draft.musicStartAtSeconds} /></div>}
    <ShareDialog dialogRef={dialogRef} recipient={guest} basePath={shareBasePath} />
  </div>;
}
