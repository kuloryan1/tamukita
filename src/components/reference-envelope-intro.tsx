"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { ReferenceTemplatePreset } from "@/lib/reference-template-presets";
import { ReferenceMotionToggle, useReferenceMotionEnabled } from "@/components/reference-motion-provider";

export function ReferenceEnvelopeIntro({ preset, hostOne, hostTwo, isExample }: {
  preset: ReferenceTemplatePreset;
  hostOne: string;
  hostTwo: string;
  isExample: boolean;
}) {
  const [opening, setOpening] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);
  const completeRef = useRef(false);
  const names = [hostOne, hostTwo].filter(Boolean).join(" dan ");
  const coverMessage = preset.coverMessage ?? `${hostOne} & ${hostTwo}`;
  const motionEnabled = useReferenceMotionEnabled();

  useEffect(() => {
    if (dismissed) return;
    const content = document.querySelector<HTMLElement>("[data-reference-content]");
    const previousOverflow = document.documentElement.style.overflow;
    const previousInert = content?.inert ?? false;
    document.documentElement.style.overflow = "hidden";
    if (content) content.inert = true;
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      if (content) content.inert = previousInert;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [dismissed]);

  useEffect(() => {
    if (!preset.showOpeningFrame) return;
    const video = videoRef.current;
    if (!video) return;
    const seekToCoverFrame = () => {
      if (!opening) video.currentTime = 0.12;
    };
    if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) seekToCoverFrame();
    else video.addEventListener("loadeddata", seekToCoverFrame, { once: true });
    return () => video.removeEventListener("loadeddata", seekToCoverFrame);
  }, [opening, preset.showOpeningFrame]);

  useEffect(() => {
    if (motionEnabled || !opening || completeRef.current) return;
    completeRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    videoRef.current?.pause();
    setDismissed(true);
  }, [motionEnabled, opening]);

  useEffect(() => {
    if (!dismissed) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector<HTMLElement>(".reference-hero-title")?.focus({ preventScroll: true });
  }, [dismissed]);

  if (dismissed) return null;

  function finishOpening() {
    if (completeRef.current) return;
    completeRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    videoRef.current?.pause();
    if (!motionEnabled) {
      setDismissed(true);
      return;
    }
    setRevealing(true);
    timerRef.current = window.setTimeout(() => setDismissed(true), 480);
  }

  function openInvitation() {
    if (opening || completeRef.current) return;
    setOpening(true);
    const video = videoRef.current;
    if (!motionEnabled || !video) return finishOpening();
    if (preset.showOpeningFrame) video.currentTime = 0;
    timerRef.current = window.setTimeout(finishOpening, 14_000);
    void video.play().catch(finishOpening);
  }

  return (
    <section className={`reference-envelope-overlay reference-envelope-overlay--${preset.slug}${preset.showOpeningFrame ? " has-opening-frame" : ""}${opening ? " is-opening" : ""}${revealing ? " is-revealing" : ""}`} role="dialog" aria-modal="true" aria-label="Sampul undangan">
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
          onEnded={finishOpening}
          onLoadedData={(event) => { if (preset.showOpeningFrame) event.currentTarget.currentTime = 0.12; }}
          onError={() => { if (opening) finishOpening(); }}
        /> : <Image className="reference-envelope-video" src={preset.coverPoster} fill alt="" aria-hidden="true" priority unoptimized />}
        {isExample && <ReferenceMotionToggle variant="cover" />}
        {coverMessage && <div className="reference-envelope-copy" aria-hidden="true">{coverMessage}</div>}
        <button className="reference-envelope-open" type="button" onClick={openInvitation} aria-label={`Putar animasi pembukaan undangan${names ? ` untuk ${names}` : ""}`}>
          <span className="reference-envelope-open-label">Tap to open</span>
        </button>
        {opening && !revealing && <button className="reference-envelope-skip" type="button" onClick={finishOpening}>Lewati animasi</button>}
      </div>
    </section>
  );
}
