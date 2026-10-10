"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, CircleHelp, Send, X } from "lucide-react";

type FeedbackCategory = "FORM" | "AUTOSAVE" | "PHOTO" | "TEMPLATE" | "PREVIEW" | "PUBLISH" | "OTHER";
type TriggerVariant = "editor" | "topbar" | "sidebar";

const categories: { value: FeedbackCategory; label: string }[] = [
  { value: "FORM", label: "Isian formulir" },
  { value: "AUTOSAVE", label: "Penyimpanan draft" },
  { value: "PHOTO", label: "Unggah atau edit foto" },
  { value: "TEMPLATE", label: "Template" },
  { value: "PREVIEW", label: "Pratinjau" },
  { value: "PUBLISH", label: "Pembayaran atau publikasi" },
  { value: "OTHER", label: "Kendala lainnya" },
];

export function EditorFeedbackDialog({ invitationId, variant = "editor" }: { invitationId?: string; variant?: TriggerVariant }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("FORM");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const titleId = variant === "sidebar" ? "dashboard-feedback-title" : variant === "topbar" ? "topbar-feedback-title" : "editor-feedback-title";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/editor-feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category, message, ...(invitationId ? { invitationId } : {}) }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusy(false);
    if (!response?.ok) {
      setError(result?.error ?? "Laporan belum terkirim. Coba lagi setelah koneksi pulih.");
      return;
    }
    setSubmitted(true);
    setMessage("");
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setError("");
    setSubmitted(false);
  }

  return <>
    <button
      type="button"
      className={variant === "sidebar" ? "sidebar-help-trigger" : variant === "topbar" ? "icon-button" : "help-icon-button"}
      aria-label={variant === "sidebar" ? "Laporkan kendala editor" : "Bantuan dan masukan"}
      title={variant === "sidebar" ? "Laporkan kendala editor" : "Bantuan dan masukan"}
      data-testid={variant === "editor" ? "editor-feedback-trigger" : undefined}
      onClick={() => setOpen(true)}
    >
      {variant === "sidebar" ? "Laporkan" : <CircleHelp size={variant === "topbar" ? 18 : 17} />}
    </button>
    {open && <div className="editor-feedback-backdrop">
      <section className="editor-feedback-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <button type="button" className="modal-close" aria-label="Tutup" onClick={close} disabled={busy}><X size={18} /></button>
        {submitted ? <div className="editor-feedback-success" role="status"><CheckCircle2 size={30} /><h2 id={titleId}>Laporan terkirim</h2><p>Tim Support akan meninjau laporan ini melalui antrean bantuan.</p><button className="button button--dark button--small" type="button" onClick={close}>Selesai</button></div> : <>
          <div className="editor-feedback-heading"><span className="eyebrow">BANTUAN TAMUKITA</span><h2 id={titleId}>Laporkan kendala editor</h2><p>Ceritakan bagian yang tidak berjalan sesuai harapan agar tim dapat meninjaunya.</p></div>
          <form className="editor-feedback-form" onSubmit={(event) => void submit(event)}>
            <label className="editor-field"><span className="field-label">Bagian yang bermasalah</span><select className="text-input" value={category} onChange={(event) => setCategory(event.target.value as FeedbackCategory)}>{categories.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label className="editor-field"><span className="field-label">Ceritakan kendalanya</span><textarea className="text-input text-area" required minLength={8} maxLength={1200} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Apa yang terjadi, dan langkah apa yang kamu lakukan?" /></label>
            <p className="editor-feedback-privacy">Jangan masukkan kata sandi, nomor kartu, atau data pribadi tamu. Nama dan email akunmu akan menyertai laporan agar Support dapat mengenali workspace.</p>
            {error && <div className="editor-error" role="alert">{error}</div>}
            <div className="editor-feedback-actions"><button className="button button--outline button--small" type="button" onClick={close} disabled={busy}>Batal</button><button className="button button--dark button--small" type="submit" disabled={busy || message.trim().length < 8}>{busy ? "Mengirim…" : "Kirim laporan"} <Send size={14} /></button></div>
          </form>
        </>}
      </section>
    </div>}
  </>;
}
