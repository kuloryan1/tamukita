"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertTriangle, Download, RotateCcw, Search, X } from "lucide-react";
import { AdminManualOrderActions, AdminManualOrderDialog, type ManualOrderAction } from "@/components/admin-manual-order-actions";

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
  paymentProvider: string;
  manualPaymentReference: string | null;
  hasRefundPaymentReference: boolean;
  refundedAmount: number;
  reservedRefundAmount: number;
  availableRefundAmount: number;
  refunds: Refund[];
};

const money = (amount: number, currency = "IDR") => new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
const dateLabel = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
const reasonLabel: Record<string, string> = { FRAUDULENT: "Transaksi mencurigakan", DUPLICATE: "Pembayaran ganda", REQUESTED_BY_CUSTOMER: "Permintaan pelanggan", CANCELLATION: "Pembatalan", OTHERS: "Alasan lain" };
const orderStatusLabel: Record<string, string> = { PENDING: "Menunggu pembayaran", PAID: "Lunas", PARTIALLY_REFUNDED: "Refund sebagian", REFUNDED: "Refund penuh", CANCELED: "Dibatalkan", FAILED: "Gagal" };
const paymentStatusLabel: Record<string, string> = { CREATED: "Sesi dibuat", PENDING: "Menunggu pembayaran", SUCCEEDED: "Terverifikasi", FAILED: "Gagal", EXPIRED: "Kedaluwarsa" };
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
  const [manualTarget, setManualTarget] = useState<{ order: AdminOrder; action: ManualOrderAction } | null>(null);
  const [refundReason, setRefundReason] = useState("REQUESTED_BY_CUSTOMER");
  const [refundNote, setRefundNote] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundPending, setRefundPending] = useState(false);
  const [manualRefundReference, setManualRefundReference] = useState("");
  const [manualFundsReturned, setManualFundsReturned] = useState(false);
  const [reconciliationFrom, setReconciliationFrom] = useState("");
  const [reconciliationTo, setReconciliationTo] = useState("");

  useEffect(() => {
    const today = new Date();
    const from = new Date(today);
    from.setUTCDate(from.getUTCDate() - 6);
    setReconciliationFrom(from.toISOString().slice(0, 10));
    setReconciliationTo(today.toISOString().slice(0, 10));
  }, []);

  const fromTime = Date.parse(`${reconciliationFrom}T00:00:00.000Z`);
  const toTime = Date.parse(`${reconciliationTo}T00:00:00.000Z`);
  const reconciliationDays = (toTime - fromTime) / (24 * 60 * 60 * 1000) + 1;
  const canExportReconciliation = Boolean(reconciliationFrom && reconciliationTo)
    && Number.isFinite(fromTime)
    && Number.isFinite(toTime)
    && reconciliationDays > 0
    && reconciliationDays <= 31;

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
      body: JSON.stringify({ reason: refundReason, amount: Number(refundAmount), adminNote: refundNote.trim(), ...(refundTarget.paymentProvider === "MANUAL" ? { manualTransferReference: manualRefundReference, fundsReturned: manualFundsReturned } : {}) }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; status?: string; refundId?: string } | null;
    setRefundPending(false);
    if (!response?.ok) { setError(result?.error ?? "Permintaan refund belum dapat dikirim."); return; }
    setNotice(refundTarget.paymentProvider === "MANUAL" ? `Refund manual ${money(Number(refundAmount))} sudah dicatat.` : result?.status === "PENDING" || result?.status === "INITIATING" ? "Permintaan tercatat. Tunggu status akhir dari webhook Xendit sebelum mencoba tindakan lain." : `Refund ${money(Number(refundAmount))} berhasil dikonfirmasi oleh Xendit.`);
    setRefundTarget(null); setRefundNote(""); setRefundAmount("");
    await loadOrders(query, 0, false);
  }

  return <>
    <section className="dashboard-content-card admin-orders-card" id="order-management">
      <div className="card-heading"><div><h2>Pencarian order & refund</h2><p>Cari transaksi di semua tanggal dan ajukan refund penuh atau sebagian untuk order undangan maupun top-up kredit.</p></div><button className="button button--outline button--small" type="button" onClick={() => void loadOrders(query, 0, false)} disabled={loading}><RotateCcw size={13} /> Muat ulang</button></div>
      <div className="admin-reconciliation">
        <div><b>Ekspor rekonsiliasi pembayaran</b><p>Unduh order, sesi pembayaran, verifikasi, dan refund untuk dicocokkan dengan catatan dana masuk. Data ini tidak menyertakan payload atau data pribadi pelanggan.</p></div>
        <label><span>Dari (UTC)</span><input type="date" value={reconciliationFrom} onChange={(event) => setReconciliationFrom(event.target.value)} aria-label="Mulai rekonsiliasi (UTC)" /></label>
        <label><span>Sampai (UTC)</span><input type="date" value={reconciliationTo} onChange={(event) => setReconciliationTo(event.target.value)} aria-label="Akhir rekonsiliasi (UTC)" /></label>
        <button className="button button--outline button--small" type="button" disabled={!canExportReconciliation} onClick={() => {
          const params = new URLSearchParams({ from: reconciliationFrom, to: reconciliationTo });
          window.location.assign(`/api/admin/orders/reconciliation?${params.toString()}`);
        }}><Download size={13} /> Unduh CSV</button>
        {!canExportReconciliation && <small className="admin-reconciliation-hint">Pilih rentang UTC yang valid, maksimal 31 hari.</small>}
      </div>
      <label className="admin-search admin-order-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari ID, pelanggan, undangan, atau reseller" aria-label="Cari order" /></label>
      {error && <div className="editor-error" role="alert">{error}</div>}
      {notice && <div className="auth-success admin-order-notice" role="status">{notice}</div>}
      <div className="admin-order-result-count">{loading ? "Memuat order..." : `${total.toLocaleString("id-ID")} order ditemukan`}</div>
      {loading ? <div className="dashboard-empty-state"><p>Memuat data order…</p></div> : orders.length === 0 ? <div className="dashboard-empty-state"><h3>Tidak ada order yang cocok</h3><p>Coba kata kunci lain.</p></div> : <div className="admin-order-list">{orders.map((order) => {
        const eligibleRefundItem = (order.itemType === "TEMPLATE_LICENSE" && Boolean(order.invitationId)) || order.itemType === "RESELLER_CREDIT";
        const canRefund = ["PAID", "PARTIALLY_REFUNDED"].includes(order.status) && eligibleRefundItem && order.hasRefundPaymentReference && order.availableRefundAmount > 0;
        return <article className="admin-order-row" key={order.id}>
          <div className="admin-order-main"><div className="admin-order-title"><b>{order.invitationTitle || order.item}</b><span className={`status-pill ${order.status === "PAID" ? "status-pill--live" : order.status === "REFUNDED" ? "status-pill--draft" : "status-pill--draft"}`}><i />{orderStatusLabel[order.status] ?? order.status}</span></div><small>{order.buyer}{order.email ? ` · ${order.email}` : ""} · {order.organization}</small><small>{order.item}{order.invitationSlug ? ` · tamukita.io/${order.invitationSlug}` : ""} · {dateLabel(order.createdAt)} · {order.id}</small>
            {order.refunds.length > 0 && <div className="admin-refund-history">{order.refunds.map((refund) => <div className="admin-refund-history-row" key={refund.id}><span><b>{money(refund.amount, refund.currency)}</b> · {reasonLabel[refund.reason] ?? refund.reason}</span><span className={`status-pill ${refund.status === "SUCCEEDED" ? "status-pill--live" : refund.status === "FAILED" || refund.status === "CANCELLED" ? "status-pill--draft" : "status-pill--draft"}`}><i />{refundStatusLabel[refund.status] ?? refund.status}</span><small>{dateLabel(refund.createdAt)} · {refund.requestedBy}{refund.failureCode ? ` · ${refund.failureCode}` : ""}{refund.adminNote ? ` · Catatan: ${refund.adminNote}` : ""}</small></div>)}</div>}
            {order.refundedAmount > 0 && <small className="admin-refund-unavailable">Sudah direfund {money(order.refundedAmount, order.currency)} · tersedia {money(order.availableRefundAmount, order.currency)}.</small>}
            {order.manualPaymentReference && <small>Referensi dana masuk: {order.manualPaymentReference}</small>}
            {eligibleRefundItem && !order.hasRefundPaymentReference && order.paymentProvider === "XENDIT" && <small className="admin-refund-unavailable">Referensi Payment Request Xendit tidak tersedia untuk refund otomatis.</small>}
          </div>
          <div className="admin-order-side"><strong>{money(order.totalAmount, order.currency)}</strong><small>{order.paymentProvider === "MANUAL" ? "QR manual" : "Xendit"} · {order.paymentProvider === "MANUAL" && order.paymentStatus === "PENDING" ? "Menunggu verifikasi" : paymentStatusLabel[order.paymentStatus] ?? order.paymentStatus}</small><AdminManualOrderActions order={order} onAction={action => setManualTarget({ order, action })} />{canRefund && <button type="button" className="button button--outline button--small" onClick={() => { setRefundTarget(order); setRefundReason("REQUESTED_BY_CUSTOMER"); setRefundAmount(String(order.availableRefundAmount)); setRefundNote(""); setManualRefundReference(""); setManualFundsReturned(false); setError(""); }}><RotateCcw size={13} /> Refund</button>}</div>
        </article>;
      })}</div>}
      {hasMore && !loading && <button className="button button--outline admin-order-load-more" type="button" disabled={loadingMore} onClick={() => void loadOrders(query, page + 1, true)}>{loadingMore ? "Memuat..." : "Muat order berikutnya"}</button>}
    </section>
    {manualTarget && <AdminManualOrderDialog key={`${manualTarget.order.id}-${manualTarget.action}`} order={manualTarget.order} action={manualTarget.action} onClose={() => setManualTarget(null)} onUpdated={() => loadOrders(query, 0, false)} />}
    {refundTarget && <div className="modal-backdrop" role="presentation">
      <section className="rsvp-modal admin-refund-modal" role="dialog" aria-modal="true" aria-labelledby="admin-refund-title">
        <button type="button" className="modal-close" aria-label="Tutup" disabled={refundPending} onClick={() => setRefundTarget(null)}><X size={18} /></button>
        <span className="eyebrow">TINDAKAN KEUANGAN</span>
        <h2 id="admin-refund-title">{refundTarget.paymentProvider === "MANUAL" ? "Catat refund manual" : "Ajukan refund"}</h2>
        <p>Sisa yang dapat dikembalikan <b>{money(refundTarget.availableRefundAmount, refundTarget.currency)}</b>. {refundTarget.paymentProvider === "MANUAL" ? "Catat pengembalian setelah dana dikirim kembali kepada pelanggan melalui bank atau e-wallet." : "Xendit membatasi refund pada nilai transaksi yang belum dikembalikan. Setelah diajukan, proses tidak dapat dibatalkan dari TamuKita."}</p>
        {refundTarget.itemType === "RESELLER_CREDIT" ? <div className="admin-refund-warning"><AlertTriangle size={15} /><span>Jumlah harus kelipatan harga per kredit {money(refundTarget.itemUnitPriceIdr)}. {refundTarget.paymentProvider === "MANUAL" ? "Kredit yang dikembalikan dikurangi saat pencatatan refund disimpan." : "Saldo kredit yang dicadangkan dikurangi saat permintaan dibuat dan dipulihkan jika Xendit menolak refund."}</span></div> : refundTarget.availableRefundAmount === refundTarget.totalAmount ? <div className="admin-refund-warning"><AlertTriangle size={15} /><span>Undangan dinonaktifkan hanya jika total refund sukses mencapai seluruh nilai order.</span></div> : null}
        <form className="auth-form" onSubmit={submitRefund}>
          <label className="editor-field"><span className="field-label">Jumlah refund (maksimal {money(refundTarget.availableRefundAmount, refundTarget.currency)})</span><input className="text-input" type="number" min="1" max={refundTarget.availableRefundAmount} step={refundTarget.itemType === "RESELLER_CREDIT" ? refundTarget.itemUnitPriceIdr : 1} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} required /></label>
          <label className="editor-field"><span className="field-label">Alasan refund</span><select className="text-input" value={refundReason} onChange={(event) => setRefundReason(event.target.value)}>{Object.entries(reasonLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {refundTarget.paymentProvider === "MANUAL" && <>
            <label className="editor-field"><span className="field-label">Referensi transfer pengembalian</span><input className="text-input" minLength={5} maxLength={100} required value={manualRefundReference} onChange={event => setManualRefundReference(event.target.value)} /></label>
            <label className="manual-payment-check"><input type="checkbox" required checked={manualFundsReturned} onChange={event => setManualFundsReturned(event.target.checked)} /><span>Dana pengembalian sudah dikirim kembali kepada pelanggan.</span></label>
          </>}
          <label className="editor-field"><span className="field-label">Catatan internal (opsional)</span><textarea className="text-input text-area" rows={3} maxLength={500} value={refundNote} onChange={(event) => setRefundNote(event.target.value)} placeholder="Konteks untuk audit internal" /></label>
          {error && <div className="editor-error" role="alert">{error}</div>}
          <button className="button button--dark button--wide" type="submit" disabled={refundPending || Number(refundAmount) < 1 || Number(refundAmount) > refundTarget.availableRefundAmount || (refundTarget.paymentProvider === "MANUAL" && (!manualFundsReturned || manualRefundReference.trim().length < 5))}>{refundPending ? "Memproses..." : refundTarget.paymentProvider === "MANUAL" ? "Catat refund manual" : "Ajukan refund ke Xendit"} <RotateCcw size={14} /></button>
        </form>
      </section>
    </div>}
  </>;
}
