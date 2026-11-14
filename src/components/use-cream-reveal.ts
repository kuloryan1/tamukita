"use client";

import { useLayoutEffect, type RefObject } from "react";

const revealTargets = [
  ".cover-photo-tile", ".countdown-section > .eyebrow", ".countdown-unit", ".countdown-timezone",
  ".event-section > .section-heading", ".event-card",
  ".event-rundown-heading", ".event-rundown li",
  ".event-gallery-heading", ".event-gallery-grid figure",
  ".invitation-paparazzi-qr", ".invitation-paparazzi-copy",
  ".guestbook-heading", ".guestbook-list",
  ".rsvp-intro", ".rsvp-card", ".gift-section > .section-heading",
  ".gift-message", ".gift-account-card", ".closing-section",
].join(", ");

export function useCreamReveal(mainRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!enabled || !main || !("IntersectionObserver" in window)) return;
    const panels = Array.from(main.querySelectorAll<HTMLElement>(revealTargets));
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-cream-reveal", "visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -24px 0px", threshold: .01 });
    // Arm before paint, after the envelope handoff. Without JS or observation,
    // content stays readable; CSS uses a gentle fade when motion is reduced.
    for (const panel of panels) {
      if (panel.getBoundingClientRect().bottom <= 0) continue;
      panel.dataset.creamReveal = "pending";
      observer.observe(panel);
    }
    const revealFocusedPanel = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      const panel = event.target.closest<HTMLElement>("[data-cream-reveal]");
      if (!panel) return;
      panel.dataset.creamReveal = "complete";
      observer.unobserve(panel);
    };
    main.addEventListener("focusin", revealFocusedPanel);
    return () => {
      observer.disconnect();
      main.removeEventListener("focusin", revealFocusedPanel);
      for (const panel of panels) delete panel.dataset.creamReveal;
    };
  }, [enabled, mainRef]);
}
