"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import type { ReferenceTemplatePreset } from "@/lib/reference-template-presets";
import { useReferenceMotionEnabled } from "@/components/reference-motion-provider";

export function ReferenceHeroMedia({ preset }: { preset: ReferenceTemplatePreset }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const motionEnabled = useReferenceMotionEnabled();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!motionEnabled) {
      video.pause();
      return;
    }
    void video.play().catch(() => undefined);
    return () => video.pause();
  }, [motionEnabled]);

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
