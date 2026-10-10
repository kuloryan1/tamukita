"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

type Application = { id: string; businessName: string; organizationName: string; ownerName: string; email: string; createdAt: string };

export function AdminResellers({ applications }: { applications: Application[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function review(id: string, status: "APPROVED" | "REJECTED") {
    setBusyId(id); setError("");
    const response = await fetch(`/api/admin/resellers/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusyId("");
    if (!response?.ok) { setError(result?.error ?? "Perubahan belum tersimpan."); return; }
    router.refresh();
  }

  return <div className="admin-reseller-list">
    {error && <div className="editor-error" role="alert">{error}</div>}
    {applications.length === 0 ? <div className="dashboard-empty-state"><h3>Antrean pengajuan kosong</h3><p>Pengajuan reseller baru akan muncul di sini.</p></div> : applications.map((application) => <article className="admin-reseller-row" key={application.id}><div><span className="eyebrow">PENGAJUAN RESELLER</span><h2>{application.businessName}</h2><p>{application.organizationName} · {application.ownerName} · {application.email}</p><small>Dikirim {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(application.createdAt))}</small></div><div className="admin-reseller-actions"><button type="button" className="button button--outline button--small" disabled={busyId === application.id} onClick={() => void review(application.id, "REJECTED")}><X size={14} /> Tolak</button><button type="button" className="button button--dark button--small" disabled={busyId === application.id} onClick={() => void review(application.id, "APPROVED")}><Check size={14} /> Setujui</button></div></article>)}
  </div>;
}
