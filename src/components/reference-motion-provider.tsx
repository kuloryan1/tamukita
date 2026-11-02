"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type MotionPreference = { enabled: boolean };

const ReferenceMotionContext = createContext<MotionPreference>({ enabled: true });

export function ReferenceMotionProvider({ children, isExample }: { children: ReactNode; isExample: boolean }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);
  const enabled = isExample || !prefersReducedMotion;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setPrefersReducedMotion(preference.matches);
    };
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (enabled) root.dataset.referenceMotion = "enabled";
    else delete root.dataset.referenceMotion;
  }, [enabled]);

  useEffect(() => () => {
    delete document.documentElement.dataset.referenceMotion;
  }, []);

  return (
    <ReferenceMotionContext.Provider value={{ enabled }}>
      {children}
    </ReferenceMotionContext.Provider>
  );
}

export function useReferenceMotionEnabled() {
  return useContext(ReferenceMotionContext).enabled;
}
