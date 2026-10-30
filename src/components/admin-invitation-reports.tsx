"use client";

import { useState } from "react";
import { ExternalLink, EyeOff, Flag, RotateCcw, ShieldCheck, X } from "lucide-react";

type Reason = "CHILD_SAFETY" | "PERSONAL_INFORMATION" | "COPYRIGHT" | "IMPERSONATION" | "SPAM" | "OTHER";
type Status = "PENDING" | "DISMISSED" | "HIDDEN" | "RESTORED";
type Action = "dismiss" | "hide" | "restore";
type InvitationStatus = "DRAFT" | "PUBLISHED" | "SUSPENDED" | "EXPIRED" | "ARCHIVED";
type Report = {
  id: string;
  reason: Reason;
  status: Status;
  createdAt: string;
  reviewedAt: string | null;
  invitation: { id: string; title: string; slug: string; status: InvitationStatus; expiresAt: string | null; paparazziAlbum?: { token: string } | null };
};
type View = "pending" | "history";

const reasonLabels: Record<Reason, string> = {
  CHILD_SAFETY: "Risiko keselamatan anak",
  PERSONAL_INFORMATION: "Informasi pribadi tanpa izin",
  COPYRIGHT: "Foto atau konten tanpa izin",
  IMPERSONATION: "Menyamar sebagai orang lain",
  SPAM: "Spam atau promosi",
  OTHER: "Alasan lainnya",
};

const statusLabels: Record<Status, string> = {
  PENDING: "Menunggu tinjauan",
  DISMISSED: "Laporan diabaikan",
  HIDDEN: "Halaman ditangguhkan",
  RESTORED: "Undangan dipulihkan",
};

const invitationVisibilityLabels: Record<InvitationStatus, string> = {
  DRAFT: "Undangan masih berupa draft.",
  PUBLISHED: "Halaman aktif untuk publik.",
  SUSPENDED: "Halaman ditangguhkan dan tidak tampil.",
  EXPIRED: "Hosting undangan sudah kedaluwarsa.",
  ARCHIVED: "Undangan diarsipkan dan tidak tampil.",
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export function AdminInvitationReports({ initialReports }: { initialReports: Report[] }) {
  const [reports, setReports] = useState(initialReports);
  const [view, setView] = useState<View>("pending");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load(nextView: View) {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/invitation-reports?view=${nextView}`).catch(() => null);
    const result = await response?.json().catch(() => null) as { reports?: Report[]; error?: string } | null;
    setLoading(false);
    if (!response?.ok || !result?.reports) {
      setError(result?.error ?? "Antrean laporan halaman belum dapat dimuat. Coba lagi.");
      return;
    }
    setReports(result.reports);
    setView(nextView);
  }

  async function review(report: Report, action: Action) {
    if (action === "hide" && !window.confirm("Tangguhkan halaman undangan ini untuk semua tamu? Halaman tidak tampil sampai ditinjau kembali.")) return;
    setBusyId(report.id);
    setError("");
    const response = await fetch(`/api/admin/invitation-reports/${encodeURIComponent(report.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusyId("");
    if (!response?.ok) {
      setError(result?.error ?? "Tindakan belum tersimpan. Muat ulang antrean dan coba lagi.");
      return;
    }
    await load(view);
  }

  return <section className="dashboard-content-card admin-content-moderation">
    <div className="card-heading"><div><h2>Laporan halaman undangan</h2><p>Periksa halaman publik sebelum menangguhkan atau mengabaikan laporan.</p></div></div>
    <div className="admin-moderation-toolbar"><fieldset className="admin-moderation-tabs" disabled={loading}>
      <legend className="sr-only">Tampilan laporan halaman</legend>
      <button className={view === "pending" ? "is-active" : ""} type="button" aria-pressed={view === "pending"} onClick={() => void load("pending")}>Perlu ditinjau</button>
      <button className={view === "history" ? "is-active" : ""} type="button" aria-pressed={view === "history"} onClick={() => void load("history")}>Riwayat 30 hari</button>
    </fieldset><span>{loading ? "Memuat..." : `${reports.length} laporan`}</span></div>
    {error && <div className="editor-error" role="alert">{error}</div>}
    {reports.length === 0 ? <div className="dashboard-empty-state"><ShieldCheck size={22} /><h3>{view === "pending" ? "Antrean bersih" : "Belum ada riwayat"}</h3><p>{view === "pending" ? "Laporan baru atas halaman undangan akan muncul di sini." : "Tindakan moderasi 30 hari terakhir akan tercatat di sini."}</p></div> : <div className="admin-report-list">{reports.map((report) => <article className="admin-report-card" key={report.id}>
      <div className="admin-report-card-heading"><div><span className="eyebrow">{reasonLabels[report.reason]}</span><h3>{report.invitation.title}</h3><p>Slug: {report.invitation.slug}</p></div><span className={`status-pill ${report.status === "PENDING" || report.status === "HIDDEN" ? "status-pill--draft" : "status-pill--live"}`}><i />{statusLabels[report.status]}</span></div>
      <div className="admin-report-meta"><span>Dilaporkan {dateLabel(report.createdAt)}</span>{report.reviewedAt && <span>Ditinjau {dateLabel(report.reviewedAt)}</span>}{report.invitation.status === "PUBLISHED" && <a href={`/${encodeURIComponent(report.invitation.slug)}`} target="_blank" rel="noreferrer">Tinjau halaman <ExternalLink size={12} /></a>}{report.invitation.status === "PUBLISHED" && report.invitation.paparazziAlbum && <a href={`/paparazi/${encodeURIComponent(report.invitation.paparazziAlbum.token)}`} target="_blank" rel="noreferrer">Tinjau galeri acara <ExternalLink size={12} /></a>}{report.invitation.status !== "PUBLISHED" && <span>{invitationVisibilityLabels[report.invitation.status]}</span>}</div>
      {view === "pending" ? <div className="admin-report-actions"><button className="button button--outline button--small" type="button" disabled={Boolean(busyId)} onClick={() => void review(report, "dismiss")}><X size={13} /> Abaikan laporan</button>{report.invitation.status === "PUBLISHED" ? <button className="button button--dark button--small" type="button" disabled={Boolean(busyId)} onClick={() => void review(report, "hide")}><EyeOff size={13} /> Tangguhkan halaman</button> : <span className="admin-report-history-note">Penangguhan tidak diperlukan untuk undangan ini.</span>}</div> : report.status === "HIDDEN" && report.invitation.status === "SUSPENDED" ? <div className="admin-report-actions"><button className="button button--outline button--small" type="button" disabled={Boolean(busyId)} onClick={() => void review(report, "restore")}><RotateCcw size={13} /> Pulihkan undangan</button></div> : <div className="admin-report-history-note"><Flag size={13} /> {report.status === "DISMISSED" ? `Laporan diabaikan. ${invitationVisibilityLabels[report.invitation.status]}` : report.status === "RESTORED" ? "Undangan dipulihkan dan tampil kembali." : invitationVisibilityLabels[report.invitation.status]}</div>}
      {busyId === report.id && <span className="admin-report-saving" role="status">Menyimpan tindakan...</span>}
    </article>)}</div>}
  </section>;
}
