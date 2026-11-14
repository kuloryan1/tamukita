"use client";

import { useLayoutEffect, type RefObject } from "react";

type MotionElement = HTMLElement | SVGElement;
type MotionKind = "copy" | "panel" | "photo" | "zoom" | "rule";
type MotionGroup = { selector: string; kind?: MotionKind; children?: string };

const motionGroups: MotionGroup[] = [
  {
    selector: ".cover-photo-tile", kind: "photo",
    children: ".cover-photo-caption > h3, .cover-photo-parents > span, .cover-photo-parents > p",
  },
  {
    selector: ".event-section > .section-heading, .event-rundown-heading, .event-gallery-heading, .rsvp-intro, .gift-section > .section-heading, .guestbook-heading, .invitation-paparazzi-copy",
    children: ":scope > :not(.rsvp-demo-note)",
  },
  {
    selector: ".event-card", kind: "panel",
    children: ":scope > svg, :scope > .eyebrow, :scope > .date-composition, :scope > .event-time, :scope > .akad-address, :scope > h3, :scope > p, :scope > .venue-rule, :scope > .venue-map-preview, :scope > .button",
  },
  {
    selector: ".event-rundown li", kind: "panel",
    children: ":scope > time, :scope > .event-rundown-index, :scope > .event-rundown-content",
  },
  {
    selector: ".rsvp-card", kind: "panel",
    children: ".rsvp-form-heading > *, .rsvp-form > .rsvp-field, .rsvp-form > .rsvp-attendance, .rsvp-submit, .rsvp-form > .rsvp-form-footnote",
  },
  { selector: ".gift-account-card", kind: "panel", children: ":scope > *" },
  { selector: ".guestbook-list", children: ":scope > .guestbook-entry, :scope > .guestbook-empty" },
  {
    selector: ".closing-section", kind: "panel",
    children: ":scope > :not(.closing-botanical)",
  },
  { selector: ".countdown-unit", kind: "zoom" },
  { selector: ".event-gallery-grid figure, .invitation-paparazzi-qr", kind: "photo" },
  { selector: ".countdown-section > .eyebrow, .countdown-timezone, .gift-message, .rsvp-jump", kind: "copy" },
];

function childMotionKind(element: Element): MotionKind {
  if (element.matches(".section-flourish, .venue-rule")) return "rule";
  if (element.matches("svg, .date-composition, .event-rundown-index")) return "zoom";
  if (element.matches(".venue-map-preview")) return "photo";
  if (element.matches(".guestbook-entry")) return "panel";
  return "copy";
}

export function useCreamReveal(mainRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!enabled || !main || !("IntersectionObserver" in window)) return;
    const panels = new Map<MotionElement, { kind: MotionKind; delay: number; originalDelay: string }>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting || entry.target.getAttribute("data-cream-reveal") !== "pending") continue;
        entry.target.setAttribute("data-cream-reveal", "visible");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -24px 0px", threshold: .01 });
    const addPanel = (panel: MotionElement, kind: MotionKind, delay = 0) => {
      if (panels.has(panel)) return;
      panels.set(panel, { kind, delay, originalDelay: panel.style.getPropertyValue("--cream-item-delay") });
      panel.dataset.creamMotion = kind;
      panel.style.setProperty("--cream-item-delay", `${delay}ms`);
      if (panel.closest('[data-cream-reveal="complete"]')) {
        panel.dataset.creamReveal = "complete";
        return;
      }
      const rect = panel.getBoundingClientRect();
      if (rect.bottom <= 0 || !rect.width || !rect.height) return;
      panel.dataset.creamReveal = "pending";
      observer.observe(panel);
    };
    const collectPanels = () => {
      for (const panel of panels.keys()) {
        if (main.contains(panel)) continue;
        observer.unobserve(panel);
        panels.delete(panel);
      }
      for (const group of motionGroups) {
        for (const root of main.querySelectorAll<MotionElement>(group.selector)) {
          if (group.kind) addPanel(root, group.kind);
          if (!group.children) continue;
          Array.from(root.querySelectorAll<MotionElement>(group.children)).forEach((child, index) => {
            addPanel(child, childMotionKind(child), Math.min((index + 1) * 200, 1_000));
          });
        }
      }
    };
    // Arm before paint, after the envelope handoff. Without JS or observation,
    // content stays readable; CSS uses a gentle fade when motion is reduced.
    collectPanels();
    const changes = new MutationObserver((records) => {
      // RSVP finishes loading after mount; new wishes can arrive after refresh.
      // Ignore countdown digit updates and other unrelated DOM changes.
      if (records.some((record) => Array.from(record.addedNodes).some((node) => node instanceof Element
        && (node.closest(".rsvp-card, .guestbook-list") || node.querySelector(".rsvp-card, .guestbook-list"))))) collectPanels();
    });
    changes.observe(main, { childList: true, subtree: true });
    const revealFocusedPanel = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return;
      let panel = event.target.closest<MotionElement>("[data-cream-reveal]");
      if (!panel) return;
      // Reveal the whole enclosing card as soon as a guest interacts with it.
      let ancestor = panel.parentElement?.closest<MotionElement>("[data-cream-reveal]");
      while (ancestor && main.contains(ancestor)) {
        panel = ancestor;
        ancestor = panel.parentElement?.closest<MotionElement>("[data-cream-reveal]");
      }
      for (const target of [panel, ...panel.querySelectorAll<MotionElement>("[data-cream-reveal]")]) {
        target.dataset.creamReveal = "complete";
        observer.unobserve(target);
      }
    };
    main.addEventListener("focusin", revealFocusedPanel);
    return () => {
      observer.disconnect();
      changes.disconnect();
      main.removeEventListener("focusin", revealFocusedPanel);
      for (const [panel, motion] of panels) {
        delete panel.dataset.creamReveal;
        delete panel.dataset.creamMotion;
        if (motion.originalDelay) panel.style.setProperty("--cream-item-delay", motion.originalDelay);
        else panel.style.removeProperty("--cream-item-delay");
      }
    };
  }, [enabled, mainRef]);
}
