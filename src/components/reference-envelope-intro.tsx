"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import type { ReferenceTemplatePreset } from "@/lib/reference-template-presets";
import { useReferenceMotionEnabled } from "@/components/reference-motion-provider";
import { useInvitationIntroDialog } from "@/components/use-invitation-intro-dialog";

export function ReferenceEnvelopeIntro({ preset, hostOne, hostTwo, autoStart = false, onComplete }: {
  preset: ReferenceTemplatePreset;
  hostOne: string;
  hostTwo: string;
  autoStart?: boolean;
  onComplete?: () => void;
}) {
  const [opening, setOpening] = useState(autoStart);
  const [playing, setPlaying] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const playbackAttempt = useRef(0);
  const startedRef = useRef(false);
  const completeRef = useRef(false);
  const names = [hostOne, hostTwo].filter(Boolean).join(" dan ");
  const coverMessage = preset.coverMessage ?? `${hostOne} & ${hostTwo}`;
  const motionEnabled = useReferenceMotionEnabled();

  useInvitationIntroDialog(dialogRef, !dismissed, finishOpening);

  const startAutomatically = useEffectEvent(openInvitation);
  useEffect(() => {
    const video = videoRef.current;
    completeRef.current = false;
    if (autoStart) startAutomatically();
    return () => {
      completeRef.current = true;
      startedRef.current = false;
      playbackAttempt.current += 1;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      video?.pause();
    };
  }, [autoStart]);

  useEffect(() => {
    if (!preset.showOpeningFrame) return;
    const video = videoRef.current;
    if (!video) return;
    const seekToCoverFrame = () => {
      if (!startedRef.current) video.currentTime = 0.12;
    };
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) seekToCoverFrame();
    else video.addEventListener("loadeddata", seekToCoverFrame, { once: true });
    return () => video.removeEventListener("loadeddata", seekToCoverFrame);
  }, [preset.showOpeningFrame]);

  const finishForReducedMotion = useEffectEvent(() => {
    if (!startedRef.current || dismissed) return;
    completeRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    videoRef.current?.pause();
    setDismissed(true);
  });
  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => { if (preference.matches) finishForReducedMotion(); };
    preference.addEventListener("change", handleChange);
    return () => preference.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (motionEnabled || !opening || completeRef.current) return;
    completeRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    videoRef.current?.pause();
    setDismissed(true);
  }, [motionEnabled, opening]);

  const handleDismissed = useEffectEvent(() => {
    if (onComplete) {
      onComplete();
      return;
    }
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector<HTMLElement>(".reference-hero-title")?.focus({ preventScroll: true });
  });
  useEffect(() => {
    if (dismissed) handleDismissed();
  }, [dismissed]);
  useEffect(() => {
    if (opening) dialogRef.current?.querySelector<HTMLButtonElement>(".reference-envelope-skip")?.focus({ preventScroll: true });
  }, [opening]);

  if (dismissed) return null;

  function finishOpening() {
    if (completeRef.current) return;
    completeRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    videoRef.current?.pause();
    if (!motionEnabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDismissed(true);
      return;
    }
    setRevealing(true);
    timerRef.current = window.setTimeout(() => setDismissed(true), 480);
  }

  function openInvitation() {
    if (startedRef.current || completeRef.current) return;
    startedRef.current = true;
    setOpening(true);
    const video = videoRef.current;
    if (!motionEnabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !video) return finishOpening();
    if (preset.showOpeningFrame) video.currentTime = 0;
    timerRef.current = window.setTimeout(finishOpening, 14_000);
    const attempt = ++playbackAttempt.current;
    void video.play().catch(() => { if (attempt === playbackAttempt.current) finishOpening(); });
  }

  return (
    <section ref={dialogRef} className={`reference-envelope-overlay reference-envelope-overlay--${preset.slug}${preset.showOpeningFrame ? " has-opening-frame" : ""}${opening ? " is-opening" : ""}${revealing ? " is-revealing" : ""}`} role="dialog" aria-modal="true" aria-label="Sampul undangan" tabIndex={-1}>
      <div className="reference-envelope-card">
        {preset.openingVideo ? <video
          ref={videoRef}
          className="reference-envelope-video"
          src={preset.openingVideo}
          poster={preset.coverPoster}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          tabIndex={-1}
          onPlaying={() => setPlaying(true)}
          onEnded={finishOpening}
          onLoadedData={(event) => { if (preset.showOpeningFrame && !startedRef.current) event.currentTarget.currentTime = 0.12; }}
          onError={() => { if (opening) finishOpening(); }}
        /> : <Image className="reference-envelope-video" src={preset.coverPoster} fill alt="" aria-hidden="true" priority unoptimized />}
        {autoStart && opening && !playing && <Image className="reference-envelope-video reference-envelope-loading-poster" src={preset.coverPoster} fill alt="" aria-hidden="true" priority unoptimized />}
        {coverMessage && !opening && <div className={`reference-envelope-copy${Array.from(coverMessage.trim()).length > 28 ? " reference-envelope-copy--long" : ""}`} aria-hidden="true">{coverMessage}</div>}
        {!opening && <button className="reference-envelope-open" type="button" onClick={openInvitation} aria-label={`Putar animasi pembukaan undangan${names ? ` untuk ${names}` : ""}`}>
          <span className="reference-envelope-open-label">Ketuk untuk membuka</span>
        </button>}
        {autoStart && opening && !playing && !revealing && <span className="reference-envelope-status" role="status">Memuat animasi…</span>}
        {opening && <button className="reference-envelope-skip" type="button" onClick={finishOpening}>Lewati animasi</button>}
      </div>
    </section>
  );
}
