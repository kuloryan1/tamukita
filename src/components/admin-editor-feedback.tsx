"use client";

import { useState } from "react";
import { Check, Clock3, MessageSquareText, RotateCcw } from "lucide-react";

type FeedbackStatus = "OPEN" | "IN_REVIEW" | "RESOLVED";
type FeedbackCategory = "FORM" | "AUTOSAVE" | "PHOTO" | "TEMPLATE" | "PREVIEW" | "PUBLISH" | "OTHER";
type FeedbackItem = {
  id: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  user: { name: string | null; email: string | null };
  invitation: { title: string; slug: string } | null;
};
type View = "active" | "resolved";

const categoryLabels: Record<FeedbackCategory, string> = {
  FORM: "Isian formulir",
  AUTOSAVE: "Penyimpanan draft",
  PHOTO: "Unggah atau edit foto",
  TEMPLATE: "Template",
  PREVIEW: "Pratinjau",
  PUBLISH: "Pembayaran atau publikasi",
  OTHER: "Kendala lainnya",
};
const statusLabels: Record<FeedbackStatus, string> = { OPEN: "Baru", IN_REVIEW: "Ditinjau", RESOLVED: "Selesai" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export function AdminEditorFeedback({ initialFeedback }: { initialFeedback: FeedbackItem[] }) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [view, setView] = useState<View>("active");
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(nextView: View) {
    setView(nextView);
    setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/editor-feedback?view=${nextView}`, { cache: "no-store" }).catch(() => null);
    const result = await response?.json().catch(() => null) as { feedback?: FeedbackItem[]; error?: string } | null;
    setLoading(false);
    if (!response?.ok || !result?.feedback) {
      setError(result?.error ?? "Antrean belum dapat dimuat.");
      return;
    }
    setFeedback(result.feedback);
  }

  async function changeStatus(item: FeedbackItem, status: FeedbackStatus) {
    setBusyId(item.id);
    setError("");
    const response = await fetch(`/api/admin/editor-feedback/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusyId("");
    if (!response?.ok) {
      setError(result?.error ?? "Status laporan belum berubah.");
      return;
    }
    const belongsInView = view === "resolved" ? status === "RESOLVED" : status !== "RESOLVED";
    setFeedback((current) => belongsInView
      ? current.map((entry) => entry.id === item.id ? { ...entry, status, updatedAt: new Date().toISOString() } : entry)
      : current.filter((entry) => entry.id !== item.id));
  }

  return <>
    <div className="admin-feedback-toolbar"><fieldset className="filter-pills"><legend className="sr-only">Filter laporan editor</legend><button type="button" aria-pressed={view === "active"} className={`filter-pill${view === "active" ? " is-selected" : ""}`} onClick={() => void load("active")}>Belum selesai</button><button type="button" aria-pressed={view === "resolved"} className={`filter-pill${view === "resolved" ? " is-selected" : ""}`} onClick={() => void load("resolved")}>Selesai</button></fieldset><span>{loading ? "Memuat…" : `${feedback.length} laporan`}</span></div>
    {error && <div className="editor-error" role="alert">{error}</div>}
    {feedback.length === 0 ? <div className="dashboard-empty-state"><MessageSquareText size={22} /><h3>{view === "active" ? "Belum ada laporan aktif" : "Belum ada laporan selesai"}</h3><p>{view === "active" ? "Laporan kendala editor akan muncul di antrean ini." : "Laporan yang selesai ditinjau dalam 30 hari terakhir akan tampil di sini."}</p></div> : <div className="admin-feedback-list">{feedback.map((item) => <article className="admin-feedback-card" key={item.id}>
      <div className="admin-feedback-card-heading"><div><span className="eyebrow">{categoryLabels[item.category]}</span><h2>{item.user.name || item.user.email || "Akun pelanggan"}</h2><p>{item.user.email || "Email akun tidak tersedia"}</p></div><span className={`status-pill ${item.status === "RESOLVED" ? "status-pill--live" : "status-pill--draft"}`}><i />{statusLabels[item.status]}</span></div>
      <p className="admin-feedback-message">{item.message}</p>
      <div className="admin-feedback-meta"><span><Clock3 size={13} /> Dikirim {formatDate(item.createdAt)}</span>{item.invitation && <span>Undangan: {item.invitation.title} · tamukita.io/{item.invitation.slug}</span>}</div>
      <div className="admin-feedback-actions">{item.status === "OPEN" && <button type="button" className="button button--outline button--small" disabled={Boolean(busyId)} onClick={() => void changeStatus(item, "IN_REVIEW")}>{busyId === item.id ? "Menyimpan…" : "Tandai ditinjau"}</button>}{item.status !== "RESOLVED" ? <button type="button" className="button button--dark button--small" disabled={Boolean(busyId)} onClick={() => void changeStatus(item, "RESOLVED")}>{busyId === item.id ? "Menyimpan…" : "Tandai selesai"} <Check size={13} /></button> : <button type="button" className="button button--outline button--small" disabled={Boolean(busyId)} onClick={() => void changeStatus(item, "OPEN")}><RotateCcw size={13} /> Buka kembali</button>}</div>
    </article>)}</div>}
  </>;
}
