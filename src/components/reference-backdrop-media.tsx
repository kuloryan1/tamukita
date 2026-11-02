"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { ReferenceTemplatePreset } from "@/lib/reference-template-presets";

export function ReferenceBackdropMedia({ preset }: { preset: ReferenceTemplatePreset }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const poster = preset.backdropPoster ?? preset.heroPoster;

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

  return (
    <div className="reference-global-backdrop" aria-hidden="true">
      <Image className="reference-global-backdrop-poster" src={poster} alt="" width={768} height={1364} priority unoptimized />
      {preset.backdropVideo && <video ref={videoRef} className="reference-global-backdrop-video" src={preset.backdropVideo} poster={poster} muted loop playsInline preload="metadata" tabIndex={-1} />}
    </div>
  );
}
