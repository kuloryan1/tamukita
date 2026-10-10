"use client";

import { useEffect } from "react";

export function MarketplaceVisitTracker() {
  useEffect(() => {
    void fetch("/api/analytics/marketplace-visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
    }).catch(() => undefined);
  }, []);

  return null;
}
