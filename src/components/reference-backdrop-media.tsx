"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import type { ReferenceTemplatePreset } from "@/lib/reference-template-presets";
import { useReferenceMotionEnabled } from "@/components/reference-motion-provider";

export function ReferenceBackdropMedia({ preset }: { preset: ReferenceTemplatePreset }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const poster = preset.backdropPoster ?? preset.heroPoster;
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

  return (
    <div className="reference-global-backdrop" aria-hidden="true">
      <Image className="reference-global-backdrop-poster" src={poster} alt="" width={768} height={1364} priority unoptimized />
      {preset.backdropVideo && <video ref={videoRef} className="reference-global-backdrop-video" src={preset.backdropVideo} poster={poster} muted loop playsInline preload="metadata" tabIndex={-1} />}
    </div>
  );
}
