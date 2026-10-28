"use client";

import { useEffect, useId, useRef, type CSSProperties, type RefObject } from "react";
import { envelopeFace, envelopeGoldColors, envelopePatch, envelopePoseAt, envelopeToneMatrix, layoutEnvelopeMonogram, posterEnvelopePose } from "@/lib/garden-envelope-monogram";

export function GardenEnvelopeMonogram({ monogram, videoRef }: {
  monogram: string;
  videoRef?: RefObject<HTMLVideoElement | null>;
}) {
  const id = useId().replace(/:/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const planeRef = useRef<SVGGElement>(null);
  const toneRef = useRef<SVGFEColorMatrixElement>(null);
  const initial = videoRef ? envelopePoseAt(0) : posterEnvelopePose;
  const gold = envelopeGoldColors(initial.gold);
  const word = layoutEnvelopeMonogram(monogram);

  useEffect(() => {
    const video = videoRef?.current;
    if (!video) return;
    let stopped = false;
    let videoFrame: number | undefined;
    let animationFrame: number | undefined;

    function paint(time: number) {
      const pose = envelopePoseAt(time);
      const colors = envelopeGoldColors(pose.gold);
      planeRef.current?.setAttribute("transform", `matrix(${pose.m.join(" ")})`);
      toneRef.current?.setAttribute("values", envelopeToneMatrix(pose.tone));
      svgRef.current?.style.setProperty("--seal-gold-light", colors.light);
      svgRef.current?.style.setProperty("--seal-gold-middle", colors.middle);
      svgRef.current?.style.setProperty("--seal-gold-dark", colors.dark);
    }

    function cancelFrame() {
      if (videoFrame !== undefined) video?.cancelVideoFrameCallback(videoFrame);
      if (animationFrame !== undefined) window.cancelAnimationFrame(animationFrame);
      videoFrame = undefined;
      animationFrame = undefined;
    }

    function nextFrame() {
      if (stopped || !video || video.paused || video.ended) return;
      if (typeof video.requestVideoFrameCallback === "function") {
        videoFrame = video.requestVideoFrameCallback((_, metadata) => {
          paint(metadata.mediaTime);
          nextFrame();
        });
      } else {
        animationFrame = window.requestAnimationFrame(() => {
          paint(video.currentTime);
          nextFrame();
        });
      }
    }

    function start() {
      cancelFrame();
      if (video) paint(video.currentTime);
      nextFrame();
    }

    function stop() {
      cancelFrame();
      if (video) paint(video.currentTime);
    }

    video.addEventListener("play", start);
    video.addEventListener("seeked", start);
    video.addEventListener("pause", stop);
    video.addEventListener("ended", stop);
    start();
    return () => {
      stopped = true;
      cancelFrame();
      video.removeEventListener("play", start);
      video.removeEventListener("seeked", start);
      video.removeEventListener("pause", stop);
      video.removeEventListener("ended", stop);
    };
  }, [videoRef]);

  return <svg ref={svgRef} className="garden-envelope-monogram" viewBox="0 0 720 1280" preserveAspectRatio="none" aria-hidden="true" focusable="false" data-monogram={word.letters} style={{
    "--seal-gold-light": gold.light,
    "--seal-gold-middle": gold.middle,
    "--seal-gold-dark": gold.dark,
  } as CSSProperties}>
    <defs>
      <radialGradient id={`${id}-edge`}>
        <stop offset="95%" stopColor="white" />
        <stop offset="100%" stopColor="black" />
      </radialGradient>
      <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="270" y="560" width="180" height="180">
        <ellipse cx={envelopeFace.cx} cy={envelopeFace.cy} rx={envelopeFace.rx} ry={envelopeFace.ry} fill={`url(#${id}-edge)`} />
      </mask>
      <filter id={`${id}-tone`} colorInterpolationFilters="sRGB">
        <feColorMatrix ref={toneRef} type="matrix" values={envelopeToneMatrix(initial.tone)} />
      </filter>
      <linearGradient id={`${id}-gold`} x1="15%" y1="100%" x2="80%" y2="0%">
        <stop stopColor="var(--seal-gold-light)" />
        <stop offset="45%" stopColor="var(--seal-gold-middle)" />
        <stop offset="100%" stopColor="var(--seal-gold-dark)" />
      </linearGradient>
      <filter id={`${id}-emboss`} x="-25%" y="-25%" width="150%" height="150%">
        <feDropShadow dx="0" dy="1" stdDeviation=".75" floodColor="#200007" floodOpacity=".85" />
        <feDropShadow dx="0" dy="-.35" stdDeviation=".15" floodColor="#fff0bb" floodOpacity=".8" />
      </filter>
    </defs>
    <g ref={planeRef} transform={`matrix(${initial.m.join(" ")})`}>
      <g mask={`url(#${id}-mask)`}>
        <ellipse cx={envelopeFace.cx} cy={envelopeFace.cy} rx={envelopeFace.rx} ry={envelopeFace.ry} fill="#60121e" />
        <image href="/templates/taman-abadi-seal-blank.webp" x={envelopePatch.x} y={envelopePatch.y} width={envelopePatch.width} height={envelopePatch.height} preserveAspectRatio="none" filter={`url(#${id}-tone)`} />
      </g>
      <g filter={`url(#${id}-emboss)`}>
        <g transform={word.transform} fill={`url(#${id}-gold)`} stroke="#582d1c" strokeWidth="6" strokeLinejoin="round" paintOrder="stroke fill">
          {word.paths.map((glyph) => <path key={glyph.key} d={glyph.d} transform={`translate(${glyph.x} 0)`} />)}
        </g>
      </g>
    </g>
  </svg>;
}
