"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { CheckCircle2, X } from "lucide-react";

type ManualOrder = { id: string; status: string; totalAmount: number; paymentProvider: string; paymentStatus: string };
export type ManualOrderAction = "confirm" | "cancel";
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export function AdminManualOrderActions({ order, onAction }: { order: ManualOrder; onAction: (action: ManualOrderAction) => void }) {
  if (order.paymentProvider !== "MANUAL" || order.status !== "PENDING" || order.paymentStatus !== "PENDING") return null;
  return <>
    <button type="button" className="button button--dark button--small" onClick={() => onAction("confirm")}><CheckCircle2 size={14} /> Verifikasi QR</button>
    <button type="button" className="button button--outline button--small" onClick={() => onAction("cancel")}>Batalkan order</button>
  </>;
}

export function AdminManualOrderDialog({ order, action, onClose, onUpdated }: { order: ManualOrder; action: ManualOrderAction; onClose: () => void; onUpdated: () => Promise<void> }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState(String(order.totalAmount));
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [received, setReceived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { dialog.current?.showModal(); }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    const payload = action === "confirm" ? { action, amountIdr: Number(amount), reference, note, fundsReceived: received } : { action, reason: note };
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/manual-payment`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusy(false);
    if (!response?.ok) { setError(result?.error ?? "Order belum dapat diperbarui."); return; }
    onClose(); await onUpdated();
  }

  return <dialog ref={dialog} className="manual-admin-dialog" aria-labelledby={`manual-payment-title-${order.id}`} onClose={onClose} onCancel={event => { if (busy) event.preventDefault(); }}>
      <button type="button" className="modal-close" aria-label="Tutup konfirmasi pembayaran" disabled={busy} onClick={onClose}><X size={18} /></button>
      <span className="eyebrow">PEMBAYARAN QR MANUAL</span><h2 id={`manual-payment-title-${order.id}`}>{action === "cancel" ? "Batalkan order" : "Konfirmasi dana masuk"}</h2>
      <p>Order {order.id}<br />Total <strong>{money(order.totalAmount)}</strong></p>
      <form className="auth-form" onSubmit={submit}>
        {action === "confirm" && <>
          <label className="editor-field"><span className="field-label">Nominal dana masuk (IDR)</span><input className="text-input" type="number" min="1" value={amount} required onChange={event => setAmount(event.target.value)} /></label>
          <label className="editor-field"><span className="field-label">Referensi transaksi pada mutasi</span><input className="text-input" minLength={5} maxLength={100} required value={reference} onChange={event => setReference(event.target.value)} /><small>Satu referensi hanya dapat dipakai untuk satu pembayaran.</small></label>
          <label className="manual-payment-check"><input type="checkbox" required checked={received} onChange={event => setReceived(event.target.checked)} /><span>Saya telah memeriksa mutasi dan dana sudah masuk dengan nominal yang sesuai.</span></label>
        </>}
        <label className="editor-field"><span className="field-label">{action === "cancel" ? "Alasan pembatalan" : "Catatan verifikasi (opsional)"}</span><textarea className="text-input text-area" minLength={action === "cancel" ? 5 : undefined} maxLength={500} required={action === "cancel"} value={note} onChange={event => setNote(event.target.value)} /></label>
        {error && <p className="editor-error" role="alert">{error}</p>}
        <button className="button button--dark button--wide" type="submit" disabled={busy || (action === "confirm" && (!received || Number(amount) !== order.totalAmount))}>{busy ? "Memproses..." : action === "cancel" ? "Batalkan order ini" : "Konfirmasi pembayaran & aktifkan"}</button>
      </form>
    </dialog>;
}
