"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";

export function AdminSupportAccessRevoke({ grantId }: { grantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function revoke() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/support-access/${encodeURIComponent(grantId)}`, { method: "DELETE" }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    if (!response?.ok) { setBusy(false); setError(result?.error ?? "Akses belum dapat dicabut."); return; }
    router.replace("/admin");
  }
  return <div className="support-access-revoke"><button type="button" className="button button--outline button--small" onClick={() => void revoke()} disabled={busy}><LockKeyhole size={14} /> {busy ? "Mencabut…" : "Cabut akses sekarang"}</button>{error && <span role="alert">{error}</span>}</div>;
}
