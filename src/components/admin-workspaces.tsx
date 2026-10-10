"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, ChevronLeft, ChevronRight, Search } from "lucide-react";

type Workspace = { id: string; name: string; slug: string; type: string; status: string; updatedAt: string; owner: string; email: string; members: number; invitations: number };
type WorkspaceResponse = { page: number; pageSize: number; total: number; workspaces: Workspace[]; error?: string };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export function AdminWorkspaces() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<WorkspaceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ q: query, page: String(page) });
        const response = await fetch(`/api/admin/workspaces?${params}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json().catch(() => null) as WorkspaceResponse | null;
        if (!response.ok || !payload) throw new Error(payload?.error ?? "Direktori workspace belum dapat dimuat.");
        setResult(payload);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Direktori workspace belum dapat dimuat.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, page]);

  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 25)));
  return <section className="dashboard-content-card admin-workspaces-card">
    <div className="card-heading"><div><h2>Workspace pelanggan</h2><p>Cari pemilik, email, nama, atau slug workspace. Informasi ditampilkan dalam mode baca saja.</p></div><Building2 size={17} /></div>
    <label className="admin-search admin-workspace-search"><Search size={14} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Nama workspace, slug, nama atau email pemilik" aria-label="Cari workspace pelanggan" /></label>
    {error && <div className="editor-error" role="alert">{error}</div>}
    {loading && !result ? <div className="dashboard-empty-state"><p>Memuat workspace…</p></div> : result?.workspaces.length ? <>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Workspace</th><th>Pemilik</th><th>Tipe / status</th><th>Anggota</th><th>Undangan</th><th>Diperbarui</th><th></th></tr></thead><tbody>{result.workspaces.map((workspace) => <tr key={workspace.id}>
        <td><b>{workspace.name}</b><small>{workspace.slug}</small></td>
        <td><b>{workspace.owner}</b><small>{workspace.email || "Email tidak tersedia"}</small></td>
        <td><span>{workspace.type}</span><small>{workspace.status}</small></td>
        <td>{workspace.members.toLocaleString("id-ID")}</td>
        <td>{workspace.invitations.toLocaleString("id-ID")}</td>
        <td>{dateLabel(workspace.updatedAt)}</td>
        <td><Link className="button button--outline button--small" href={`/admin/workspaces/${workspace.id}`}>Detail</Link></td>
      </tr>)}</tbody></table></div>
      <div className="admin-pagination"><span>{result.total.toLocaleString("id-ID")} workspace · halaman {page} dari {pageCount}</span><div><button className="button button--outline button--small" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={15} /></button><button className="button button--outline button--small" type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => current + 1)} aria-label="Halaman berikutnya"><ChevronRight size={15} /></button></div></div>
    </> : <div className="dashboard-empty-state"><h3>{query ? "Workspace tidak ditemukan" : "Belum ada workspace"}</h3><p>{query ? "Coba kata kunci lain." : "Workspace pelanggan akan tampil di sini."}</p></div>}
  </section>;
}
