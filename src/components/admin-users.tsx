"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import { PLATFORM_ROLE_OPTIONS, getPlatformRoleLabel, type PlatformRoleValue } from "@/lib/platform-roles";

type PlatformUser = { id: string; name: string | null; email: string | null; platformRole: PlatformRoleValue; createdAt: string; workspaceCount: number };
type UserResponse = { page: number; pageSize: number; total: number; users: PlatformUser[]; error?: string };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export function AdminUsers({ actorId }: { actorId: string }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<UserResponse | null>(null);
  const [roleDrafts, setRoleDrafts] = useState<Record<string, PlatformRoleValue>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ q: query, page: String(page) });
        const response = await fetch(`/api/admin/users?${params}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json().catch(() => null) as UserResponse | null;
        if (!response.ok || !payload) throw new Error(payload?.error ?? "Direktori pengguna belum dapat dimuat.");
        setResult(payload);
        setRoleDrafts(Object.fromEntries(payload.users.map((user) => [user.id, user.platformRole])));
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        setError(caught instanceof Error ? caught.message : "Direktori pengguna belum dapat dimuat.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, page]);

  async function saveRole(user: PlatformUser) {
    const platformRole = roleDrafts[user.id];
    if (!platformRole || platformRole === user.platformRole || user.id === actorId) return;
    setBusyId(user.id);
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ platformRole }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null) as { error?: string } | null;
    setBusyId("");
    if (!response?.ok) {
      setError(payload?.error ?? "Peran pengguna belum tersimpan.");
      return;
    }
    setResult((current) => current ? { ...current, users: current.users.map((entry) => entry.id === user.id ? { ...entry, platformRole } : entry) } : current);
    setRoleDrafts((current) => ({ ...current, [user.id]: platformRole }));
    setNotice(`Peran ${user.email ?? user.name ?? "pengguna"} diperbarui menjadi ${getPlatformRoleLabel(platformRole)} dan dicatat di audit log.`);
  }

  const pageCount = Math.max(1, Math.ceil((result?.total ?? 0) / (result?.pageSize ?? 25)));

  return <section className="dashboard-content-card admin-users-card">
    <div className="card-heading"><div><h2>Direktori akun</h2><p>Peran platform hanya dapat diubah oleh Super Admin. Peran workspace reseller dikelola melalui direktori workspace.</p></div><Users size={17} /></div>
    <label className="admin-search"><Search size={14} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Cari nama atau email pengguna" aria-label="Cari pengguna" /></label>
    {error && <div className="editor-error" role="alert">{error}</div>}
    {notice && <p className="admin-managed-success" role="status">{notice}</p>}
    {loading && !result ? <div className="dashboard-empty-state"><p>Memuat direktori pengguna…</p></div> : result?.users.length ? <>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pengguna</th><th>Peran platform</th><th>Workspace</th><th>Terdaftar</th><th>Aksi</th></tr></thead><tbody>{result.users.map((user) => {
        const role = roleDrafts[user.id] ?? user.platformRole;
        const ownAccount = user.id === actorId;
        return <tr key={user.id} data-testid={`admin-user-row-${user.id}`}>
          <td><b>{user.name ?? "Tanpa nama"}</b><small>{user.email ?? "Email tidak tersedia"}</small></td>
          <td><label className="sr-only" htmlFor={`platform-role-${user.id}`}>Peran platform {user.email ?? user.name ?? user.id}</label><select id={`platform-role-${user.id}`} value={role} disabled={ownAccount || busyId === user.id} onChange={(event) => setRoleDrafts((current) => ({ ...current, [user.id]: event.target.value as PlatformRoleValue }))}>{PLATFORM_ROLE_OPTIONS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select><small>{ownAccount ? "Akun Anda dilindungi" : PLATFORM_ROLE_OPTIONS.find((option) => option.value === role)?.description}</small></td>
          <td>{user.workspaceCount.toLocaleString("id-ID")}</td>
          <td>{dateLabel(user.createdAt)}</td>
          <td><button className="button button--outline button--small" type="button" disabled={ownAccount || busyId === user.id || role === user.platformRole} onClick={() => void saveRole(user)}>{busyId === user.id ? "Menyimpan…" : "Simpan peran"}</button></td>
        </tr>;
      })}</tbody></table></div>
      <div className="admin-pagination"><span>{result.total.toLocaleString("id-ID")} pengguna · halaman {page} dari {pageCount}</span><div><button className="button button--outline button--small" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={15} /></button><button className="button button--outline button--small" type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => current + 1)} aria-label="Halaman berikutnya"><ChevronRight size={15} /></button></div></div>
    </> : <div className="dashboard-empty-state"><h3>{query ? "Pengguna tidak ditemukan" : "Belum ada akun pengguna"}</h3><p>{query ? "Coba nama atau email lain." : "Akun yang terdaftar akan tampil di sini."}</p></div>}
  </section>;
}
