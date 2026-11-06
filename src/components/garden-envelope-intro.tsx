"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState, type TransitionEvent } from "react";
import { GardenEnvelopeMonogram } from "@/components/garden-envelope-monogram";
import { useInvitationIntroDialog } from "@/components/use-invitation-intro-dialog";
import { resolveSealMonogram } from "@/lib/seal-monogram";

const envelopeCover = "/templates/taman-abadi-envelope-cover.png";
const envelopeVideo = "/templates/taman-abadi-envelope-opening.mp4";

export function GardenEnvelopeIntro({ hostOne, hostTwo, monogram, autoStart = false, onComplete }: { hostOne: string; hostTwo: string; monogram?: string; isExample?: boolean; autoStart?: boolean; onComplete?: () => void }) {
  const [opening, setOpening] = useState(autoStart);
  const [playing, setPlaying] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timer = useRef<number | null>(null);
  const stallTimer = useRef<number | null>(null);
  const lastVideoTime = useRef(0);
  const playbackAttempt = useRef(0);
  const started = useRef(false);
  const revealStarted = useRef(false);
  const finished = useRef(false);
  const names = [hostOne, hostTwo].filter(Boolean).join(" dan ");
  const initials = resolveSealMonogram(monogram, [hostOne, hostTwo]);

  useInvitationIntroDialog(dialogRef, !dismissed, finishOpening);

  const startAutomatically = useEffectEvent(openInvitation);
  useEffect(() => {
    const video = videoRef.current;
    finished.current = false;
    if (autoStart) startAutomatically();
    return () => {
      finished.current = true;
      started.current = false;
      playbackAttempt.current += 1;
      revealStarted.current = false;
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (stallTimer.current !== null) window.clearTimeout(stallTimer.current);
      video?.pause();
    };
  }, [autoStart]);

  useEffect(() => {
    const page = document.querySelector<HTMLElement>('.public-invitation-page[data-template="taman-abadi"]');
    if (!page) return;

    const revealTargets = Array.from(page.querySelectorAll<HTMLElement>("[data-garden-reveal]"));

    let observer: IntersectionObserver | undefined;
    if (!("IntersectionObserver" in window)) {
      revealTargets.forEach((target) => {
        target.classList.add("is-visible");
      });
    } else {
      revealTargets.forEach((target) => {
        if (target.getBoundingClientRect().top <= window.innerHeight * 0.9) target.classList.add("is-visible");
      });
      page.classList.add("garden-motion-ready");

      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer?.unobserve(entry.target);
        });
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });

      revealTargets.forEach((target) => {
        if (!target.classList.contains("is-visible")) observer?.observe(target);
      });
    }

    return () => {
      observer?.disconnect();
      page.classList.remove("garden-motion-ready", "garden-invitation-opened");
    };
  }, []);

  const finishForReducedMotion = useEffectEvent(() => {
    if (started.current && !finished.current) finishOpening();
  });
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => { if (preference.matches) finishForReducedMotion(); };
    preference.addEventListener("change", handleChange);
    return () => preference.removeEventListener("change", handleChange);
  }, []);

  const handleDismissed = useEffectEvent(() => {
    if (onComplete) {
      onComplete();
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector<HTMLElement>(".garden-copy-heading")?.focus({ preventScroll: true });
  });
  useEffect(() => {
    if (dismissed) handleDismissed();
  }, [dismissed]);
  useEffect(() => {
    if (opening) dialogRef.current?.querySelector<HTMLButtonElement>(".garden-envelope-skip")?.focus({ preventScroll: true });
  }, [opening]);

  if (dismissed) return null;

  function finishOpening() {
    if (finished.current) return;
    finished.current = true;
    if (timer.current !== null) window.clearTimeout(timer.current);
    if (stallTimer.current !== null) window.clearTimeout(stallTimer.current);
    videoRef.current?.pause();
    document.querySelector<HTMLElement>('.public-invitation-page[data-template="taman-abadi"]')?.classList.add("garden-invitation-opened");
    setDismissed(true);
  }

  function handleTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
    if (revealStarted.current && event.target === event.currentTarget && event.propertyName === "opacity") {
      finishOpening();
    }
  }

  function revealInvitation() {
    if (finished.current || revealStarted.current) return;
    if (stallTimer.current !== null) window.clearTimeout(stallTimer.current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return finishOpening();
    // Begin the normal crossfade only after the native ended event. An early
    // fade can pause/unmount a buffering clip before its final frames play.
    revealStarted.current = true;
    if (timer.current !== null) window.clearTimeout(timer.current);
    document.querySelector<HTMLElement>('.public-invitation-page[data-template="taman-abadi"]')?.classList.add("garden-invitation-opened");
    setRevealing(true);
    timer.current = window.setTimeout(finishOpening, 1_500);
  }

  function armStallRecovery() {
    if (stallTimer.current !== null) window.clearTimeout(stallTimer.current);
    // Some Safari/WebKit decoders deliver the first frame and then stop advancing
    // without firing a media error. Recover with the original garden crossfade.
    stallTimer.current = window.setTimeout(revealInvitation, 6_000);
  }

  function handleProgress(event: React.SyntheticEvent<HTMLVideoElement>) {
    if (!started.current || finished.current || revealStarted.current) return;
    const position = event.currentTarget.currentTime;
    if (position > lastVideoTime.current + 0.025) {
      lastVideoTime.current = position;
      armStallRecovery();
    }
  }

  function handlePlaying() {
    if (finished.current || revealStarted.current) return;
    // Keep the absolute deadline active if a clip stalls after it starts.
    setPlaying(true);
    armStallRecovery();
  }

  function openInvitation() {
    if (started.current || finished.current) return;
    started.current = true;
    window.scrollTo({ top: 0, behavior: "instant" });
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return finishOpening();
    setOpening(true);
    const video = videoRef.current;
    if (!video) return finishOpening();
    timer.current = window.setTimeout(finishOpening, 15_000);
    lastVideoTime.current = 0;
    armStallRecovery();
    const attempt = ++playbackAttempt.current;
    void video.play().catch(() => { if (attempt === playbackAttempt.current) finishOpening(); });
  }

  return (
    <div ref={dialogRef} className={`garden-envelope-overlay${playing ? " is-playing" : ""}${revealing ? " is-revealing" : ""}`} role="dialog" aria-modal="true" aria-label="Sampul undangan" tabIndex={-1} onTransitionEnd={handleTransitionEnd}>
      <div className="garden-envelope-video-layer" aria-hidden="true">
        <span className="garden-envelope-media">
        <video
          ref={videoRef}
          src={envelopeVideo}
          poster={envelopeCover}
          className="garden-envelope-video"
          width={720}
          height={1280}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
          onPlaying={handlePlaying}
          onTimeUpdate={handleProgress}
          onEnded={revealInvitation}
          onError={finishOpening}
        />
        <GardenEnvelopeMonogram monogram={initials} videoRef={videoRef} />
        </span>
      </div>
      <button
        className="garden-envelope-cover"
        type="button"
        onClick={openInvitation}
        disabled={opening}
        aria-hidden={opening || undefined}
        aria-label={`Putar animasi dan buka undangan${names ? ` ${names}` : ""}`}
      >
        <span className="garden-envelope-still">
          <Image className="garden-envelope-art" src={envelopeCover} width={941} height={1672} alt="" draggable={false} preload unoptimized />
          <GardenEnvelopeMonogram monogram={initials} />
        </span>
        {!opening && <span className="garden-envelope-prompt" aria-hidden="true"><span className="garden-envelope-chevron" /><span className="garden-envelope-tap-label">KETUK UNTUK MEMBUKA</span></span>}
      </button>
      {opening && !playing && <span className="garden-envelope-status" role="status">Memuat animasi…</span>}
      <button className="garden-envelope-skip" type="button" onClick={finishOpening}>{opening ? "Lewati animasi" : "Buka langsung"}</button>
    </div>
  );
}
