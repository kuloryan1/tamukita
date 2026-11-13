"use client";

import { useEffect, type RefObject } from "react";

const revealTargets = [
  ".cover-photo-tile", ".countdown-section > .eyebrow", ".countdown-unit",
  ".event-section > .section-heading", ".event-card",
  ".event-rundown-heading", ".event-rundown li",
  ".event-gallery-heading", ".event-gallery-grid figure",
  ".rsvp-intro", ".rsvp-card", ".gift-section > .section-heading",
  ".gift-message", ".gift-account-card", ".closing-section",
].join(", ");

export function useCreamReveal(mainRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const main = mainRef.current;
    if (!enabled || !main || !("IntersectionObserver" in window)) return;
    const panels = Array.from(main.querySelectorAll<HTMLElement>(revealTargets));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    const refresh = () => {
      observer?.disconnect();
      for (const panel of panels) delete panel.dataset.creamReveal;
      if (reducedMotion.matches) return;
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-cream-reveal", "visible");
          observer?.unobserve(entry.target);
        }
      }, { rootMargin: "0px 0px -28px 0px", threshold: .06 });
      // Content stays visible before observation, including deep links and fast scrolls.
      for (const panel of panels) observer.observe(panel);
    };
    refresh();
    reducedMotion.addEventListener("change", refresh);
    return () => {
      observer?.disconnect();
      reducedMotion.removeEventListener("change", refresh);
      for (const panel of panels) delete panel.dataset.creamReveal;
    };
  }, [enabled, mainRef]);
}
