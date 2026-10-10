"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, X } from "lucide-react";

export function AdminSupportAccessButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/invitations/${encodeURIComponent(invitationId)}/support-access`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const result = await response.json().catch(() => null) as { grantId?: string; error?: string } | null;
      if (!response.ok || !result?.grantId) throw new Error(result?.error ?? "Akses bantuan belum dapat dibuat.");
      router.push(`/admin/support-access/${encodeURIComponent(result.grantId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Akses bantuan belum dapat dibuat.");
      setBusy(false);
    }
  }

  return <>
    <button className="button button--outline button--small" type="button" onClick={() => { setOpen(true); setError(""); }}><Eye size={13} /> Akses bantuan</button>
    {open && <div className="modal-backdrop" role="presentation">
      <section className="support-access-dialog" role="dialog" aria-modal="true" aria-labelledby="support-access-title">
        <div className="support-access-dialog-heading"><div><span className="eyebrow">AKSES TERBATAS</span><h2 id="support-access-title">Buka data untuk bantuan</h2></div><button className="modal-close" type="button" disabled={busy} onClick={() => setOpen(false)} aria-label="Tutup"><X size={18} /></button></div>
        <p>Akses ini hanya untuk membaca isi undangan, berlaku 15 menit, dan setiap pembukaan dicatat di audit workspace. Kamu tidak masuk sebagai pelanggan dan tidak dapat melihat tamu atau transaksi. Jangan masukkan password, kode verifikasi, atau rahasia lain pada alasan.</p>
        <form onSubmit={(event) => void requestAccess(event)}>
          <label className="editor-field"><span className="field-label">Alasan akses</span><textarea className="text-input text-area" minLength={15} maxLength={500} rows={4} required value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Contoh: menelusuri laporan pelanggan bahwa foto sampul tidak muncul di ponsel." /></label>
          {error && <div className="editor-error" role="alert">{error}</div>}
          <div className="support-access-dialog-actions"><button type="button" className="button button--outline button--small" disabled={busy} onClick={() => setOpen(false)}>Batal</button><button type="submit" className="button button--dark button--small" disabled={busy || reason.trim().length < 15}>{busy ? "Membuka akses…" : "Buka baca saja"}</button></div>
        </form>
      </section>
    </div>}
  </>;
}
