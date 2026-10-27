"use client";

import { useState, type FormEvent } from "react";
import { Flag } from "lucide-react";

type Reason = "CHILD_SAFETY" | "PERSONAL_INFORMATION" | "COPYRIGHT" | "IMPERSONATION" | "SPAM" | "OTHER";

export function PublicInvitationReport({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<Reason | "">("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setError("");
    const response = await fetch(`/api/public/invitations/${encodeURIComponent(slug)}/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setSending(false);
    if (!response?.ok) {
      setError(result?.error ?? "Laporan belum dapat dikirim. Coba lagi.");
      return;
    }
    setSent(true);
    setOpen(false);
  }

  return <div className="public-invitation-report">
    {sent ? <span className="public-invitation-report-status" role="status">Laporan diterima untuk ditinjau.</span> : <>
      <button className="public-invitation-report-trigger" type="button" aria-expanded={open} aria-controls="public-invitation-report-form" onClick={() => { setOpen((value) => !value); setError(""); }}>
        <Flag size={13} /> Laporkan undangan
      </button>
      {open && <form id="public-invitation-report-form" className="public-invitation-report-form" onSubmit={submit}>
        <p>Pilih alasan yang paling sesuai. Kami menyimpan alasan dan penanda anonim untuk mencegah laporan berulang.</p>
        <label>
          <span>Alasan laporan</span>
          <select required value={reason} onChange={(event) => setReason(event.target.value as Reason | "")}>
            <option value="" disabled>Pilih alasan laporan</option>
            <option value="CHILD_SAFETY">Risiko keselamatan anak</option>
            <option value="PERSONAL_INFORMATION">Informasi pribadi tanpa izin</option>
            <option value="COPYRIGHT">Foto atau konten tanpa izin</option>
            <option value="IMPERSONATION">Menyamar sebagai orang lain</option>
            <option value="SPAM">Spam atau promosi</option>
            <option value="OTHER">Alasan lainnya</option>
          </select>
        </label>
        {error && <span className="editor-error" role="alert">{error}</span>}
        <div className="public-invitation-report-actions">
          <button className="button button--dark button--small" type="submit" disabled={sending}>{sending ? "Mengirim..." : "Kirim laporan"}</button>
          <button className="button button--outline button--small" type="button" disabled={sending} onClick={() => { setOpen(false); setError(""); }}>Batal</button>
        </div>
      </form>}
    </>}
  </div>;
}
