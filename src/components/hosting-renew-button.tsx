"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export function HostingRenewButton({ invitationId }: { invitationId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function renew() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/renew`, { method: "POST" }).catch(() => null);
    const result = await response?.json().catch(() => null) as { checkoutUrl?: string; error?: string } | null;
    setBusy(false);
    if (!response?.ok || !result?.checkoutUrl) {
      setError(result?.error ?? "Tautan perpanjangan belum dapat dibuat.");
      return;
    }
    window.location.assign(result.checkoutUrl);
  }

  return <span className="hosting-renew-control"><button type="button" className="button button--dark button--small" onClick={() => void renew()} disabled={busy}>{busy ? "Menyiapkan..." : <>Perpanjang hosting <RefreshCw size={13} /></>}</button>{error && <small role="alert">{error}</small>}</span>;
}
