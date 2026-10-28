"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type TransitionEvent } from "react";
import { GardenEnvelopeMonogram } from "@/components/garden-envelope-monogram";
import { resolveSealMonogram } from "@/lib/seal-monogram";

const envelopeCover = "/templates/taman-abadi-envelope-cover.png";
const envelopeVideo = "/templates/taman-abadi-envelope-opening.mp4";

export function GardenEnvelopeIntro({ hostOne, hostTwo, monogram }: { hostOne: string; hostTwo: string; monogram?: string }) {
  const [opening, setOpening] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timer = useRef<number | null>(null);
  const revealStarted = useRef(false);
  const finished = useRef(false);
  const names = [hostOne, hostTwo].filter(Boolean).join(" dan ");
  const initials = resolveSealMonogram(monogram, [hostOne, hostTwo]);

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
      if (timer.current !== null) window.clearTimeout(timer.current);
      observer?.disconnect();
      page.classList.remove("garden-motion-ready", "garden-invitation-opened");
    };
  }, []);

  useEffect(() => {
    if (dismissed) return;
    const page = document.querySelector<HTMLElement>('.public-invitation-page[data-template="taman-abadi"]');
    const previousOverflow = document.documentElement.style.overflow;
    const siblings = Array.from(page?.children ?? []).filter((element): element is HTMLElement => element instanceof HTMLElement && !element.classList.contains("garden-envelope-overlay"));
    const previousInert = siblings.map((element) => element.inert);
    document.documentElement.style.overflow = "hidden";
    siblings.forEach((element) => { element.inert = true; });
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      siblings.forEach((element, index) => { element.inert = previousInert[index]; });
    };
  }, [dismissed]);

  useEffect(() => {
    if (!dismissed) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector<HTMLElement>(".garden-copy-heading")?.focus({ preventScroll: true });
  }, [dismissed]);

  if (dismissed) return null;

  function finishOpening() {
    if (finished.current) return;
    finished.current = true;
    if (timer.current !== null) window.clearTimeout(timer.current);
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
    revealStarted.current = true;
    if (timer.current !== null) window.clearTimeout(timer.current);
    document.querySelector<HTMLElement>('.public-invitation-page[data-template="taman-abadi"]')?.classList.add("garden-invitation-opened");
    setRevealing(true);
    timer.current = window.setTimeout(finishOpening, 1_500);
  }

  function handlePlaying() {
    if (finished.current || revealStarted.current) return;
    if (timer.current !== null) window.clearTimeout(timer.current);
    setPlaying(true);
  }

  function handleTimeUpdate() {
    const video = videoRef.current;
    if (video && Number.isFinite(video.duration) && video.duration > 0 && video.currentTime >= video.duration - 0.8) {
      revealInvitation();
    }
  }

  function openInvitation() {
    if (opening || finished.current) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    setOpening(true);
    const video = videoRef.current;
    if (!video) return finishOpening();
    timer.current = window.setTimeout(finishOpening, 15_000);
    void video.play().catch(finishOpening);
  }

  return (
    <div className={`garden-envelope-overlay${playing ? " is-playing" : ""}${revealing ? " is-revealing" : ""}`} role="dialog" aria-modal="true" aria-label="Sampul undangan" onTransitionEnd={handleTransitionEnd}>
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
          onTimeUpdate={handleTimeUpdate}
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
        aria-label={`Putar animasi dan buka undangan${names ? ` ${names}` : ""}`}
      >
        <span className="garden-envelope-still">
          <Image className="garden-envelope-art" src={envelopeCover} width={941} height={1672} alt="" draggable={false} preload unoptimized />
          <GardenEnvelopeMonogram monogram={initials} />
        </span>
        <span className="garden-envelope-prompt" aria-hidden="true"><span className="garden-envelope-chevron" /><span className="garden-envelope-tap-label">TAP TO OPEN</span></span>
      </button>
      {opening && !playing && <span className="garden-envelope-status" role="status">Memuat animasi…</span>}
      <button className="garden-envelope-skip" type="button" onClick={finishOpening}>{opening ? "Lewati animasi" : "Buka langsung"}</button>
    </div>
  );
}
