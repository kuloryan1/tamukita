"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, CheckCircle2, Clock3, Copy, MessageCircle, QrCode, RefreshCw } from "lucide-react";
import type { ManualOrderPayment } from "@/lib/manual-orders";

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export function ManualPayment({ initial }: { initial: ManualOrderPayment }) {
  const [order, setOrder] = useState(initial);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const pending = order.status === "PENDING";
  const paid = order.status === "PAID" || order.status === "PARTIALLY_REFUNDED";
  const destination = order.kind === "reseller" ? "/reseller" : order.invitationId && !order.publishedSlug ? `/dashboard/invitations/${order.invitationId}/edit` : "/dashboard";

  const refresh = useCallback(async (explicit = false) => {
    if (explicit) { setChecking(true); setError(""); }
    const response = await fetch(`/api/orders/${encodeURIComponent(initial.id)}/payment`, { cache: "no-store" }).catch(() => null);
    const data = await response?.json().catch(() => null) as (ManualOrderPayment & { error?: string }) | null;
    if (response?.ok && data?.id === initial.id) setOrder(data);
    else if (explicit) setError(data?.error ?? "Status belum dapat diperbarui. Coba kembali sebentar lagi.");
    if (explicit) setChecking(false);
  }, [initial.id]);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 20_000);
    return () => window.clearInterval(timer);
  }, [pending, refresh]);

  async function copy(value: string, label: string) {
    try { await navigator.clipboard.writeText(value); setCopied(label); }
    catch { setError("Belum dapat menyalin. Pilih dan salin teks yang ditampilkan."); }
  }

  return <div className="manual-payment-page">
    <Link href={order.kind === "reseller" ? "/reseller" : "/dashboard"} className="admin-back-link"><ArrowLeft size={15} /> Kembali ke {order.kind === "reseller" ? "reseller" : "dashboard"}</Link>
    <div className="dashboard-page-heading"><div><p className="dashboard-date">PEMBAYARAN · {order.code}</p><h1><QrCode size={26} /> Pembayaran QR</h1><p>{order.invitationTitle}</p></div></div>
    <div className={`manual-payment-status${paid ? " is-paid" : ""}`} role="status">
      {paid ? <CheckCircle2 size={21} /> : <Clock3 size={21} />}
      <div><strong>{paid ? "Pembayaran terkonfirmasi" : pending ? "Menunggu pembayaran dan verifikasi admin" : order.status === "REFUNDED" ? "Pengembalian dana telah dicatat" : "Order tidak aktif"}</strong><p>{paid ? order.kind === "reseller" ? "Kredit sudah ditambahkan ke akun reseller." : order.publishedSlug ? "Undangan sudah aktif dan siap dibagikan." : "Pembayaran tersimpan. Lengkapi detail undangan untuk menerbitkannya." : pending ? "Setelah membayar, kirim bukti lewat WhatsApp. Admin akan mencocokkan dana masuk dengan order ini." : "Buka dashboard untuk memeriksa undangan atau membuat order baru."}</p></div>
    </div>
    {pending ? <div className="manual-payment-grid">
      <section className="dashboard-content-card manual-payment-scan" aria-labelledby="manual-qr-title">
        <h2 id="manual-qr-title">1. Scan QR pembayaran</h2>
        <p>Gunakan aplikasi bank atau e-wallet, lalu masukkan nominal berikut.</p>
        <div className="manual-payment-amount"><span>Total yang dibayar</span><strong>{money(order.amountIdr)}</strong><button type="button" onClick={() => void copy(String(order.amountIdr), "Nominal tersalin")}><Copy size={14} /> Salin nominal</button></div>
        <div className="manual-payment-qr-frame"><Image src={order.qrImageUrl} alt="QR pembayaran TamuKita untuk dipindai dengan aplikasi bank atau e-wallet" width={600} height={800} className="manual-payment-qr" unoptimized /></div>
        <a className="manual-payment-full-qr" href={order.qrImageUrl} target="_blank" rel="noreferrer">Buka QR ukuran penuh <ArrowUpRight size={14} /></a>
        <small>Jika membayar dari ponsel yang sama, simpan QR ke galeri lalu gunakan fitur pindai dari galeri di aplikasi pembayaran.</small>
      </section>
      <section className="dashboard-content-card manual-payment-confirm" aria-labelledby="manual-confirm-title">
        <h2 id="manual-confirm-title">2. Kirim bukti pembayaran</h2>
        <p>Kirim bukti dan nomor order ke admin melalui WhatsApp. Status akan diperbarui setelah dana masuk dikonfirmasi.</p>
        <div className="manual-payment-order-id"><span>Nomor order</span><code>{order.id}</code><button type="button" onClick={() => void copy(order.id, "Nomor order tersalin")}><Copy size={14} /> Salin nomor order</button></div>
        {order.whatsappUrl && <a href={order.whatsappUrl} target="_blank" rel="noreferrer" className="button button--dark button--wide"><MessageCircle size={17} /> Kirim bukti via WhatsApp</a>}
        <div className="manual-payment-next"><h3>Sudah mengirim bukti?</h3><p>Tunggu verifikasi admin. Pembayaran cukup dilakukan satu kali untuk order ini.</p><button className="button button--outline button--wide" type="button" disabled={checking} onClick={() => void refresh(true)}><RefreshCw size={15} /> {checking ? "Memeriksa..." : "Cek status pembayaran"}</button></div>
      </section>
    </div> : <div className="manual-payment-actions"><Link href={destination} className="button button--dark">{order.kind === "reseller" ? "Buka akun reseller" : paid && !order.publishedSlug ? "Lengkapi undangan" : "Buka dashboard"} <ArrowUpRight size={15} /></Link>{paid && order.publishedSlug && <Link className="button button--outline" href={`/${order.publishedSlug}`} target="_blank">Lihat undangan <ArrowUpRight size={15} /></Link>}</div>}
    {copied && <p className="admin-managed-success" role="status">{copied}</p>}
    {error && <p className="editor-error" role="alert">{error}</p>}
  </div>;
}
