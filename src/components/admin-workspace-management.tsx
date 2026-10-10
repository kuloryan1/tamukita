"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, ShieldAlert, UserRoundMinus } from "lucide-react";

type Member = { id: string; userId: string; role: string; user: { name: string | null; email: string | null; platformRole: string } };
type Props = { workspaceId: string; workspaceName: string; workspaceType: string; workspaceStatus: string; members: Member[] };

const roleLabels: Record<string, string> = {
  OWNER: "Pemilik",
  ADMIN: "Admin workspace",
  EDITOR: "Editor",
  VIEWER: "Viewer",
  RESELLER_STAFF: "Staf reseller",
};

export function AdminWorkspaceManagement({ workspaceId, workspaceName, workspaceType, workspaceStatus, members }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(workspaceStatus);
  const [roles, setRoles] = useState<Record<string, string>>(() => Object.fromEntries(members.map((member) => [member.id, member.role])));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function send(path: string, method: "PATCH" | "DELETE", body?: unknown) {
    setBusy(path);
    setError("");
    setNotice("");
    const response = await fetch(path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const payload = await response?.json().catch(() => null) as { error?: string } | null;
    setBusy("");
    if (!response?.ok) {
      setError(payload?.error ?? "Perubahan belum tersimpan.");
      return false;
    }
    setNotice("Perubahan tersimpan dan tercatat di audit admin.");
    router.refresh();
    return true;
  }

  const memberRoles = workspaceType === "RESELLER" ? ["ADMIN", "EDITOR", "VIEWER", "RESELLER_STAFF"] : ["ADMIN", "EDITOR", "VIEWER"];
  const statusPath = `/api/admin/workspaces/${encodeURIComponent(workspaceId)}`;

  return <section className="dashboard-content-card admin-workspace-management">
    <div className="card-heading"><div><h2>Kelola workspace</h2><p>Ubah status workspace dan akses anggota. Setiap perubahan dicatat di audit admin.</p></div><ShieldAlert size={17} /></div>
    <div className="admin-workspace-status-control">
      <div><b>{workspaceName}</b><small>Status saat ini: {status}</small></div>
      <label><span>Status workspace</span><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status workspace"><option value="ACTIVE">Aktif</option><option value="SUSPENDED">Ditangguhkan</option><option value="ARCHIVED">Diarsipkan</option></select></label>
      <button className="button button--dark button--small" type="button" disabled={busy === statusPath || status === workspaceStatus} onClick={() => void send(statusPath, "PATCH", { status })}><Save size={14} /> Simpan status</button>
    </div>
    {status === "SUSPENDED" && <p className="admin-workspace-warning">Workspace yang ditangguhkan tidak dapat mengedit atau membuka undangan publik. Datanya tetap tersimpan.</p>}
    {status === "ARCHIVED" && <p className="admin-workspace-warning">Workspace yang diarsipkan tidak aktif dan dapat dipulihkan dengan mengubah statusnya kembali.</p>}

    <div className="admin-workspace-members-heading"><div><h3>Anggota workspace</h3><p>Peran pemilik dilindungi. Untuk memindahkan kepemilikan, gunakan alur transfer tersendiri.</p></div></div>
    {members.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Nama</th><th>Email</th><th>Peran workspace</th><th>Peran platform</th><th>Aksi</th></tr></thead><tbody>{members.map((member) => {
      const role = roles[member.id] ?? member.role;
      const path = `/api/admin/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(member.id)}`;
      return <tr key={member.id}>
        <td><b>{member.user.name ?? "Tanpa nama"}</b></td>
        <td>{member.user.email ?? "—"}</td>
        <td>{member.role === "OWNER" ? <span className="admin-member-role">{roleLabels[member.role]}</span> : <select value={role} onChange={(event) => setRoles((current) => ({ ...current, [member.id]: event.target.value }))} aria-label={`Peran ${member.user.name ?? member.user.email ?? "anggota"}`}>{memberRoles.map((option) => <option value={option} key={option}>{roleLabels[option]}</option>)}</select>}</td>
        <td>{member.user.platformRole}</td>
        <td><div className="admin-member-actions">{member.role === "OWNER" ? <small>Dilindungi</small> : <>
          <button className="button button--outline button--small" type="button" disabled={busy === path || role === member.role} onClick={() => void send(path, "PATCH", { role })}><Save size={13} /> Simpan</button>
          <button className="button button--outline button--small" type="button" disabled={busy === path} onClick={() => { if (window.confirm(`Hapus ${member.user.name ?? member.user.email ?? "anggota ini"} dari ${workspaceName}?`)) void send(path, "DELETE"); }} aria-label={`Hapus ${member.user.name ?? member.user.email ?? "anggota"}`}><UserRoundMinus size={13} /> Hapus</button>
        </>}</div></td>
      </tr>;
    })}</tbody></table></div> : <div className="dashboard-empty-state"><h3>Belum ada anggota</h3></div>}
    {error && <div className="editor-error" role="alert">{error}</div>}
    {notice && <p className="admin-managed-success" role="status">{notice}</p>}
  </section>;
}
