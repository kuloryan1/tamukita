"use client";

import { useEffect, type RefObject } from "react";

export function useCreamParallax(mainRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const main = mainRef.current;
    if (!enabled || !main) return;
    if (window.CSS?.supports?.("(animation-timeline: view()) and (view-timeline: --cream-hero block) and (animation-range: cover 0% cover 100%)")) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const layers = Array.from(main.querySelectorAll<HTMLElement | SVGElement>(
      ".hero-botanical, .cover-photo-frame, .closing-botanical",
    )).map((element) => ({
      element,
      parent: element.closest(".invitation-hero, .cover-photo-tile, .closing-section") ?? main,
      depth: 0,
    }));
    let frame = 0;
    const update = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const rects = new Map<Element, DOMRect>();
      for (const layer of layers) {
        if (!rects.has(layer.parent)) rects.set(layer.parent, layer.parent.getBoundingClientRect());
      }
      const offsets = layers.map((layer) => {
        const rect = rects.get(layer.parent) ?? layer.parent.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (viewport - rect.top) / (viewport + rect.height)));
        return (progress - .5) * layer.depth;
      });
      layers.forEach((layer, index) => { layer.element.style.setProperty("--cream-parallax-y", `${offsets[index].toFixed(2)}px`); });
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const refresh = () => {
      for (const layer of layers) layer.depth = Number.parseFloat(getComputedStyle(layer.element).getPropertyValue("--cream-parallax-depth")) || 0;
      schedule();
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", refresh, { passive: true });
    reducedMotion.addEventListener("change", refresh);
    refresh();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", refresh);
      reducedMotion.removeEventListener("change", refresh);
      window.cancelAnimationFrame(frame);
      for (const layer of layers) layer.element.style.removeProperty("--cream-parallax-y");
    };
  }, [enabled, mainRef]);
}
