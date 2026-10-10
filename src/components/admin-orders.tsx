"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, RotateCcw, Search, X } from "lucide-react";

type Refund = { id: string; amount: number; currency: string; reason: string; adminNote: string | null; failureCode: string | null; status: string; createdAt: string; requestedBy: string };
type AdminOrder = {
  id: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
  buyer: string;
  email: string;
  organization: string;
  invitationId: string | null;
  invitationTitle: string;
  invitationSlug: string;
  item: string;
  itemType: string;
  itemQuantity: number;
  itemUnitPriceIdr: number;
  paymentStatus: string;
  hasRefundPaymentReference: boolean;
  refundedAmount: number;
  reservedRefundAmount: number;
  availableRefundAmount: number;
  refunds: Refund[];
};

const money = (amount: number, currency = "IDR") => new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
const dateLabel = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
const reasonLabel: Record<string, string> = { FRAUDULENT: "Transaksi mencurigakan", DUPLICATE: "Pembayaran ganda", REQUESTED_BY_CUSTOMER: "Permintaan pelanggan", CANCELLATION: "Pembatalan", OTHERS: "Alasan lain" };
const refundStatusLabel: Record<string, string> = { INITIATING: "Menunggu konfirmasi", PENDING: "Diproses Xendit", SUCCEEDED: "Berhasil", FAILED: "Gagal", CANCELLED: "Dibatalkan" };

export function AdminOrders() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [refundTarget, setRefundTarget] = useState<AdminOrder | null>(null);
  const [refundReason, setRefundReason] = useState("REQUESTED_BY_CUSTOMER");
  const [refundNote, setRefundNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundPending, setRefundPending] = useState(false);

  const loadOrders = useCallback(async (search = query, nextPage = 0, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    setError("");
    const response = await fetch(`/api/admin/orders?q=${encodeURIComponent(search)}&page=${nextPage}`, { cache: "no-store" }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; orders?: AdminOrder[]; total?: number; hasMore?: boolean } | null;
    if (!response?.ok || !result?.orders) {
      setError(result?.error ?? "Daftar order belum dapat dimuat. Coba lagi.");
      setLoading(false); setLoadingMore(false);
      return;
    }
    const pageOrders = result.orders;
    setOrders((current) => append ? [...current, ...pageOrders] : pageOrders);
    setPage(nextPage);
    setTotal(result.total ?? 0);
    setHasMore(Boolean(result.hasMore));
    setLoading(false); setLoadingMore(false);
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadOrders(query, 0, false); }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadOrders, query]);

  async function submitRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!refundTarget) return;
    setRefundPending(true); setError(""); setNotice("");
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(refundTarget.id)}/refunds`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: refundReason, amount: Number(refundAmount), adminNote: refundNote.trim() }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; status?: string; refundId?: string } | null;
    setRefundPending(false);
    if (!response?.ok) { setError(result?.error ?? "Permintaan refund belum dapat dikirim."); return; }
    setNotice(result?.status === "PENDING" || result?.status === "INITIATING" ? "Permintaan tercatat. Tunggu status akhir dari webhook Xendit sebelum mencoba tindakan lain." : `Refund ${money(Number(refundAmount))} berhasil dikonfirmasi oleh Xendit.`);
    setRefundTarget(null); setRefundNote(""); setRefundAmount("");
    await loadOrders(query, 0, false);
  }

  return <>
    <section className="dashboard-content-card admin-orders-card" id="order-management">
      <div className="card-heading"><div><h2>Pencarian order & refund</h2><p>Cari transaksi di semua tanggal dan ajukan refund penuh atau sebagian untuk order undangan maupun top-up kredit.</p></div><button className="button button--outline button--small" type="button" onClick={() => void loadOrders(query, 0, false)} disabled={loading}><RotateCcw size={13} /> Muat ulang</button></div>
      <label className="admin-search admin-order-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari ID, pelanggan, undangan, atau reseller" aria-label="Cari order" /></label>
      {error && <div className="editor-error" role="alert">{error}</div>}
      {notice && <div className="auth-success admin-order-notice" role="status">{notice}</div>}
      <div className="admin-order-result-count">{loading ? "Memuat order..." : `${total.toLocaleString("id-ID")} order ditemukan`}</div>
      {loading ? <div className="dashboard-empty-state"><p>Memuat data order…</p></div> : orders.length === 0 ? <div className="dashboard-empty-state"><h3>Tidak ada order yang cocok</h3><p>Coba kata kunci lain.</p></div> : <div className="admin-order-list">{orders.map((order) => {
        const eligibleRefundItem = (order.itemType === "TEMPLATE_LICENSE" && Boolean(order.invitationId)) || order.itemType === "RESELLER_CREDIT";
        const canRefund = ["PAID", "PARTIALLY_REFUNDED"].includes(order.status) && eligibleRefundItem && order.hasRefundPaymentReference && order.availableRefundAmount > 0;
        return <article className="admin-order-row" key={order.id}>
          <div className="admin-order-main"><div className="admin-order-title"><b>{order.invitationTitle || order.item}</b><span className={`status-pill ${order.status === "PAID" ? "status-pill--live" : order.status === "REFUNDED" ? "status-pill--draft" : "status-pill--draft"}`}><i />{order.status === "PAID" ? "Lunas" : order.status === "PARTIALLY_REFUNDED" ? "Refund sebagian" : order.status === "REFUNDED" ? "Refund" : order.status}</span></div><small>{order.buyer}{order.email ? ` · ${order.email}` : ""} · {order.organization}</small><small>{order.item}{order.invitationSlug ? ` · tamukita.io/${order.invitationSlug}` : ""} · {dateLabel(order.createdAt)} · {order.id}</small>
            {order.refunds.length > 0 && <div className="admin-refund-history">{order.refunds.map((refund) => <div className="admin-refund-history-row" key={refund.id}><span><b>{money(refund.amount, refund.currency)}</b> · {reasonLabel[refund.reason] ?? refund.reason}</span><span className={`status-pill ${refund.status === "SUCCEEDED" ? "status-pill--live" : refund.status === "FAILED" || refund.status === "CANCELLED" ? "status-pill--draft" : "status-pill--draft"}`}><i />{refundStatusLabel[refund.status] ?? refund.status}</span><small>{dateLabel(refund.createdAt)} · {refund.requestedBy}{refund.failureCode ? ` · ${refund.failureCode}` : ""}{refund.adminNote ? ` · Catatan: ${refund.adminNote}` : ""}</small></div>)}</div>}
            {order.refundedAmount > 0 && <small className="admin-refund-unavailable">Sudah direfund {money(order.refundedAmount, order.currency)} · tersedia {money(order.availableRefundAmount, order.currency)}.</small>}
            {eligibleRefundItem && !order.hasRefundPaymentReference && <small className="admin-refund-unavailable">Referensi Payment Request Xendit tidak tersedia untuk refund otomatis.</small>}
          </div>
          <div className="admin-order-side"><strong>{money(order.totalAmount, order.currency)}</strong><small>Sesi: {order.paymentStatus}</small>{canRefund && <button type="button" className="button button--outline button--small" onClick={() => { setRefundTarget(order); setRefundReason("REQUESTED_BY_CUSTOMER"); setRefundAmount(String(order.availableRefundAmount)); setRefundNote(""); setError(""); }}><RotateCcw size={13} /> Refund</button>}</div>
        </article>;
      })}</div>}
      {hasMore && !loading && <button className="button button--outline admin-order-load-more" type="button" disabled={loadingMore} onClick={() => void loadOrders(query, page + 1, true)}>{loadingMore ? "Memuat..." : "Muat order berikutnya"}</button>}
    </section>
    {refundTarget && <div className="modal-backdrop" role="presentation">
      <section className="rsvp-modal admin-refund-modal" role="dialog" aria-modal="true" aria-labelledby="admin-refund-title">
        <button type="button" className="modal-close" aria-label="Tutup" disabled={refundPending} onClick={() => setRefundTarget(null)}><X size={18} /></button>
        <span className="eyebrow">TINDAKAN KEUANGAN</span>
        <h2 id="admin-refund-title">Ajukan refund</h2>
        <p>Sisa yang dapat dikembalikan <b>{money(refundTarget.availableRefundAmount, refundTarget.currency)}</b>. Xendit membatasi refund pada nilai transaksi yang belum dikembalikan. Setelah diajukan, proses tidak dapat dibatalkan dari TamuKita.</p>
        {refundTarget.itemType === "RESELLER_CREDIT" ? <div className="admin-refund-warning"><AlertTriangle size={15} /><span>Jumlah harus kelipatan harga per kredit {money(refundTarget.itemUnitPriceIdr)}. Saldo kredit yang dicadangkan dikurangi saat permintaan dibuat dan dipulihkan jika Xendit menolak refund.</span></div> : refundTarget.availableRefundAmount === refundTarget.totalAmount ? <div className="admin-refund-warning"><AlertTriangle size={15} /><span>Undangan dinonaktifkan hanya jika total refund sukses mencapai seluruh nilai order.</span></div> : null}
        <form className="auth-form" onSubmit={submitRefund}>
          <label className="editor-field"><span className="field-label">Jumlah refund (maksimal {money(refundTarget.availableRefundAmount, refundTarget.currency)})</span><input className="text-input" type="number" min="1" max={refundTarget.availableRefundAmount} step={refundTarget.itemType === "RESELLER_CREDIT" ? refundTarget.itemUnitPriceIdr : 1} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} required /></label>
          <label className="editor-field"><span className="field-label">Alasan refund</span><select className="text-input" value={refundReason} onChange={(event) => setRefundReason(event.target.value)}>{Object.entries(reasonLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="editor-field"><span className="field-label">Catatan internal (opsional)</span><textarea className="text-input text-area" rows={3} maxLength={500} value={refundNote} onChange={(event) => setRefundNote(event.target.value)} placeholder="Konteks untuk audit internal" /></label>
          {error && <div className="editor-error" role="alert">{error}</div>}
          <button className="button button--dark button--wide" type="submit" disabled={refundPending || Number(refundAmount) < 1 || Number(refundAmount) > refundTarget.availableRefundAmount}>{refundPending ? "Mengirim permintaan..." : "Ajukan refund ke Xendit"} <RotateCcw size={14} /></button>
        </form>
      </section>
    </div>}
  </>;
}
