"use client";

import { useEffect, type RefObject } from "react";

export function useCreamParallax(mainRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const main = mainRef.current;
    if (!enabled || !main) return;
    const nativeScroll = window.CSS?.supports?.("(animation-timeline: view()) and (view-timeline: --cream-hero block) and (animation-range: cover 0% cover 100%)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const layers = Array.from(main.querySelectorAll<HTMLElement | SVGElement>(
      ".hero-botanical, .cover-photo-frame, .closing-botanical, .event-gallery-grid img, .invitation-hero .monogram > :is(img, svg)",
    )).map((element) => ({
      element,
      parent: element.closest(".invitation-hero, .cover-photo-tile, .closing-section, .event-gallery-grid figure") ?? main,
      scrolls: element.matches(".hero-botanical, .cover-photo-frame, .closing-botanical"),
      active: false,
      depth: 0,
      depthX: 0,
    }));
    const parents = new Set(layers.map((layer) => layer.parent));
    const visibleParents = new Set<Element>();
    let observer: IntersectionObserver | null = null;
    let frame = 0;
    const update = () => {
      frame = 0;
      const viewport = window.innerHeight;
      const activeLayers = layers.filter((layer) => layer.active && layer.scrolls);
      const rects = new Map<Element, DOMRect>();
      for (const layer of activeLayers) {
        if (!rects.has(layer.parent)) rects.set(layer.parent, layer.parent.getBoundingClientRect());
      }
      const offsets = activeLayers.map((layer) => {
        const rect = rects.get(layer.parent) ?? layer.parent.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (viewport - rect.top) / (viewport + rect.height)));
        return { x: (progress - .5) * layer.depthX, y: (progress - .5) * layer.depth };
      });
      activeLayers.forEach((layer, index) => {
        layer.element.style.setProperty("--cream-parallax-x", `${offsets[index].x.toFixed(2)}px`);
        layer.element.style.setProperty("--cream-parallax-y", `${offsets[index].y.toFixed(2)}px`);
      });
    };
    const schedule = () => {
      if (reducedMotion.matches || document.hidden || frame || (nativeScroll && observer)) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        if (!observer) {
          const viewport = window.innerHeight;
          for (const parent of parents) {
            const rect = parent.getBoundingClientRect();
            if (rect.bottom >= -96 && rect.top <= viewport + 96) visibleParents.add(parent);
            else visibleParents.delete(parent);
          }
          syncActivity(false);
        }
        if (!nativeScroll) update();
      });
    };
    const syncActivity = (scheduleUpdate = true) => {
      const motionAllowed = !reducedMotion.matches && !document.hidden;
      for (const layer of layers) {
        layer.active = motionAllowed && visibleParents.has(layer.parent);
        layer.element.toggleAttribute("data-cream-layer-active", layer.active);
      }
      if (!motionAllowed) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      if (scheduleUpdate) schedule();
    };
    const handleActivityChange = () => syncActivity();
    const refresh = () => {
      for (const layer of layers.filter((layer) => layer.scrolls && !nativeScroll)) {
        const styles = getComputedStyle(layer.element);
        layer.depth = Number.parseFloat(styles.getPropertyValue("--cream-parallax-depth")) || 0;
        layer.depthX = Number.parseFloat(styles.getPropertyValue("--cream-parallax-x-depth")) || 0;
        if (reducedMotion.matches) {
          layer.element.style.removeProperty("--cream-parallax-x");
          layer.element.style.removeProperty("--cream-parallax-y");
        }
      }
      if (!observer) {
        const viewport = window.innerHeight;
        for (const parent of parents) {
          const rect = parent.getBoundingClientRect();
          if (rect.bottom >= -96 && rect.top <= viewport + 96) visibleParents.add(parent);
          else visibleParents.delete(parent);
        }
      }
      syncActivity();
    };
    observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visibleParents.add(entry.target);
        else visibleParents.delete(entry.target);
      }
      syncActivity();
    }, { rootMargin: "96px 0px" }) : null;
    for (const parent of parents) {
      observer?.observe(parent);
    }
    if (!nativeScroll || !observer) window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", refresh, { passive: true });
    document.addEventListener("visibilitychange", handleActivityChange);
    reducedMotion.addEventListener("change", refresh);
    refresh();
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", refresh);
      document.removeEventListener("visibilitychange", handleActivityChange);
      reducedMotion.removeEventListener("change", refresh);
      window.cancelAnimationFrame(frame);
      for (const layer of layers) {
        layer.element.removeAttribute("data-cream-layer-active");
        layer.element.style.removeProperty("--cream-parallax-x");
        layer.element.style.removeProperty("--cream-parallax-y");
      }
    };
  }, [enabled, mainRef]);
}
