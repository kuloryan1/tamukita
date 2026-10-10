"use client";

import { useState } from "react";
import { ExternalLink, EyeOff, Flag, RotateCcw, ShieldCheck, X } from "lucide-react";

type Report = {
  id: string;
  reason: "SPAM" | "HARASSMENT" | "PERSONAL_INFORMATION" | "OTHER";
  status: "PENDING" | "DISMISSED" | "HIDDEN" | "RESTORED";
  createdAt: string;
  reviewedAt: string | null;
  guestbookEntry: {
    id: string;
    displayName: string;
    message: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
    createdAt: string;
    invitation: { id: string; title: string; slug: string };
  };
};

type View = "pending" | "history";
type Action = "dismiss" | "hide" | "restore";

const reasonLabels: Record<Report["reason"], string> = {
  SPAM: "Spam atau promosi",
  HARASSMENT: "Pelecehan atau ujaran menyerang",
  PERSONAL_INFORMATION: "Informasi pribadi",
  OTHER: "Alasan lainnya",
};

const statusLabels: Record<Report["status"], string> = {
  PENDING: "Menunggu tinjauan",
  DISMISSED: "Laporan diabaikan",
  HIDDEN: "Ucapan disembunyikan",
  RESTORED: "Ucapan dipulihkan",
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export function AdminContentModeration({ initialReports }: { initialReports: Report[] }) {
  const [reports, setReports] = useState(initialReports);
  const [view, setView] = useState<View>("pending");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function load(nextView: View) {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/content-reports?view=${nextView}`).catch(() => null);
    const result = await response?.json().catch(() => null) as { reports?: Report[]; error?: string } | null;
    setLoading(false);
    if (!response?.ok || !result?.reports) {
      setError(result?.error ?? "Antrean belum dapat dimuat. Coba lagi.");
      return;
    }
    setReports(result.reports);
    setView(nextView);
  }

  async function review(report: Report, action: Action) {
    setBusyId(report.id);
    setError("");
    const response = await fetch(`/api/admin/content-reports/${encodeURIComponent(report.id)}`, {
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
    <div className="admin-moderation-toolbar"><fieldset className="admin-moderation-tabs">
      <legend className="sr-only">Tampilan laporan</legend>
      <button className={view === "pending" ? "is-active" : ""} type="button" aria-pressed={view === "pending"} onClick={() => void load("pending")}>Perlu ditinjau</button>
      <button className={view === "history" ? "is-active" : ""} type="button" aria-pressed={view === "history"} onClick={() => void load("history")}>Riwayat 30 hari</button>
    </fieldset><span>{loading ? "Memuat..." : `${reports.length} laporan`}</span></div>
    {error && <div className="editor-error" role="alert">{error}</div>}
    {reports.length === 0 ? <div className="dashboard-empty-state"><ShieldCheck size={22} /><h3>{view === "pending" ? "Antrean bersih" : "Belum ada riwayat"}</h3><p>{view === "pending" ? "Laporan baru dari tamu akan muncul di sini." : "Tindakan moderasi 30 hari terakhir akan tercatat di sini."}</p></div> : <div className="admin-report-list">{reports.map((report) => <article className="admin-report-card" key={report.id}>
      <div className="admin-report-card-heading"><div><span className="eyebrow">{reasonLabels[report.reason]}</span><h2>{report.guestbookEntry.displayName}</h2><p>Untuk <b>{report.guestbookEntry.invitation.title}</b> · tamukita.io/{report.guestbookEntry.invitation.slug}</p></div><span className={`status-pill ${report.status === "PENDING" ? "status-pill--draft" : report.status === "HIDDEN" ? "status-pill--draft" : "status-pill--live"}`}><i />{statusLabels[report.status]}</span></div>
      <blockquote>{report.guestbookEntry.message}</blockquote>
      <div className="admin-report-meta"><span>Dilaporkan {dateLabel(report.createdAt)}</span>{report.reviewedAt && <span>Ditinjau {dateLabel(report.reviewedAt)}</span>}<a href={`/${encodeURIComponent(report.guestbookEntry.invitation.slug)}`} target="_blank" rel="noreferrer">Lihat undangan <ExternalLink size={12} /></a></div>
      {view === "pending" ? <div className="admin-report-actions"><button className="button button--outline button--small" type="button" disabled={Boolean(busyId)} onClick={() => void review(report, "dismiss")}><X size={13} /> Abaikan laporan</button><button className="button button--dark button--small" type="button" disabled={Boolean(busyId)} onClick={() => void review(report, "hide")}><EyeOff size={13} /> Sembunyikan ucapan</button></div> : report.status === "HIDDEN" ? <div className="admin-report-actions"><button className="button button--outline button--small" type="button" disabled={Boolean(busyId)} onClick={() => void review(report, "restore")}><RotateCcw size={13} /> Pulihkan ucapan</button></div> : <div className="admin-report-history-note"><Flag size={13} /> {report.status === "DISMISSED" ? "Ucapan tetap tampil di undangan." : "Ucapan kembali tampil di undangan."}</div>}
      {busyId === report.id && <span className="admin-report-saving" role="status">Menyimpan tindakan...</span>}
    </article>)}</div>}
  </section>;
}
