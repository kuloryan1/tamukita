"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { ReferenceTemplatePreset } from "@/lib/reference-template-presets";

export function ReferenceHeroMedia({ preset }: { preset: ReferenceTemplatePreset }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!video) return;
    const updatePlayback = () => {
      if (motion.matches) {
        video.pause();
        return;
      }
      void video.play().catch(() => undefined);
    };
    updatePlayback();
    motion.addEventListener("change", updatePlayback);
    return () => {
      motion.removeEventListener("change", updatePlayback);
      video.pause();
    };
  }, []);

  if (!preset.heroVideo) {
    return <Image className="reference-hero-media reference-hero-poster" src={preset.heroPoster} fill alt="" aria-hidden="true" priority unoptimized />;
  }

  return (
    <>
      <Image className="reference-hero-media reference-hero-poster" src={preset.heroPoster} fill alt="" aria-hidden="true" priority unoptimized />
      <video
        ref={videoRef}
        className="reference-hero-media reference-hero-video"
        src={preset.heroVideo}
        poster={preset.heroPoster}
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  );
}
