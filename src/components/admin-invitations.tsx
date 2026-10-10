"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Search } from "lucide-react";

type AdminInvitation = { id: string; title: string; slug: string; status: "PUBLISHED" | "SUSPENDED"; owner: string; email: string; organization: string; updatedAt: string };

export function AdminInvitations({ invitations }: { invitations: AdminInvitation[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return invitations;
    return invitations.filter((invitation) => [invitation.title, invitation.slug, invitation.owner, invitation.email, invitation.organization].some((value) => value.toLowerCase().includes(normalized)));
  }, [invitations, query]);

  async function setStatus(invitation: AdminInvitation, status: "PUBLISHED" | "SUSPENDED") {
    setBusyId(invitation.id); setError("");
    const response = await fetch(`/api/admin/invitations/${invitation.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusyId("");
    if (!response?.ok) { setError(result?.error ?? "Status undangan belum berubah."); return; }
    router.refresh();
  }

  return <section className="dashboard-content-card admin-invitations-card"><div className="card-heading"><div><h2>Moderasi undangan</h2><p>Undangan aktif terbaru dan yang sedang ditangguhkan.</p></div><label className="admin-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari undangan atau pemilik" aria-label="Cari undangan" /></label></div>{error && <div className="editor-error" role="alert">{error}</div>}{filtered.length === 0 ? <div className="dashboard-empty-state"><h3>{invitations.length === 0 ? "Belum ada undangan" : "Tidak ada hasil"}</h3><p>{invitations.length === 0 ? "Undangan aktif akan tampil di sini." : "Coba kata kunci lain."}</p></div> : <div className="admin-invitation-list">{filtered.map((invitation) => <article className="admin-invitation-row" key={invitation.id}><div><div className="admin-invitation-title"><b>{invitation.title}</b><span className={`status-pill ${invitation.status === "PUBLISHED" ? "status-pill--live" : "status-pill--draft"}`}><i />{invitation.status === "PUBLISHED" ? "Aktif" : "Ditangguhkan"}</span></div><small>{invitation.organization} · {invitation.owner}{invitation.email ? ` · ${invitation.email}` : ""}</small><small>{invitation.status === "PUBLISHED" ? `tamukita.io/${invitation.slug}` : `Slug: ${invitation.slug}`}</small></div><div className="admin-invitation-actions">{invitation.status === "PUBLISHED" && <a className="button button--outline button--small" href={`/${encodeURIComponent(invitation.slug)}`} target="_blank" rel="noreferrer">Lihat <ExternalLink size={13} /></a>}<button className={`button button--small ${invitation.status === "PUBLISHED" ? "button--outline" : "button--dark"}`} type="button" disabled={Boolean(busyId)} onClick={() => void setStatus(invitation, invitation.status === "PUBLISHED" ? "SUSPENDED" : "PUBLISHED")}>{busyId === invitation.id ? "Menyimpan..." : invitation.status === "PUBLISHED" ? "Tangguhkan" : "Pulihkan"}</button></div></article>)}</div>}</section>;
}
