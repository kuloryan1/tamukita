"use client";

import { useEffect } from "react";
import { useReferenceMotionEnabled } from "@/components/reference-motion-provider";

export function ReferenceRevealObserver() {
  const motionEnabled = useReferenceMotionEnabled();

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reference-reveal]"));
    if (!targets.length || !motionEnabled || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-reveal-visible", "true");
        observer.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });

    for (const target of targets) {
      target.setAttribute("data-reveal-ready", "true");
      observer.observe(target);
    }

    return () => observer.disconnect();
  }, [motionEnabled]);

  return null;
}
