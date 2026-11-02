"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type MotionPreference = {
  enabled: boolean;
  ready: boolean;
  prefersReducedMotion: boolean;
  showControl: boolean;
  toggle: () => void;
};

const ReferenceMotionContext = createContext<MotionPreference>({
  enabled: false,
  ready: false,
  prefersReducedMotion: true,
  showControl: false,
  toggle: () => undefined,
});

export function ReferenceMotionProvider({ children, isExample }: { children: ReactNode; isExample: boolean }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);
  const [ready, setReady] = useState(false);
  const [motionOverride, setMotionOverride] = useState<boolean | null>(null);
  const enabled = motionOverride ?? !prefersReducedMotion;

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      setPrefersReducedMotion(preference.matches);
      setMotionOverride(null);
      setReady(true);
    };
    updatePreference();
    preference.addEventListener("change", updatePreference);
    return () => preference.removeEventListener("change", updatePreference);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (prefersReducedMotion && enabled) root.dataset.referenceMotion = "enabled";
    else delete root.dataset.referenceMotion;
  }, [enabled, prefersReducedMotion]);

  useEffect(() => () => {
    delete document.documentElement.dataset.referenceMotion;
  }, []);

  const toggle = () => setMotionOverride(!enabled);

  return (
    <ReferenceMotionContext.Provider value={{
      enabled,
      ready,
      prefersReducedMotion,
      showControl: isExample && ready && prefersReducedMotion,
      toggle,
    }}>
      {children}
    </ReferenceMotionContext.Provider>
  );
}

export function useReferenceMotionEnabled() {
  return useContext(ReferenceMotionContext).enabled;
}

export function ReferenceMotionToggle({ variant }: { variant: "page" | "cover" }) {
  const { enabled, showControl, toggle } = useContext(ReferenceMotionContext);
  if (!showControl) return null;

  return (
    <button
      type="button"
      className={`reference-motion-toggle reference-motion-toggle--${variant}`}
      aria-pressed={enabled}
      onClick={toggle}
    >
      {enabled ? "Matikan animasi" : "Aktifkan animasi"}
    </button>
  );
}
