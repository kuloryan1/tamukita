"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { QrCode, Save, Upload } from "lucide-react";
import type { PaymentSettings } from "@/lib/payment-methods";

export function AdminPaymentSettings({ initial }: { initial: PaymentSettings }) {
  const [mode, setMode] = useState(initial.mode);
  const [qrImageUrl, setQrImageUrl] = useState(initial.qrImageUrl);
  const [whatsapp, setWhatsapp] = useState(initial.whatsapp);
  const [ready, setReady] = useState(initial.ready);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function upload(file?: File) {
    if (!file) return;
    setNotice(""); setError("");
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5_000_000) { setError("Gunakan gambar QR PNG, JPG, atau WebP maksimal 5 MB."); return; }
    setUploading(true);
    const response = await fetch("/api/admin/settings/payment-qr", { method: "POST", headers: { "content-type": file.type }, body: file }).catch(() => null);
    const data = await response?.json().catch(() => null) as { url?: string; error?: string } | null;
    setUploading(false);
    if (!response?.ok || !data?.url) { setError(data?.error ?? "QR belum berhasil diunggah."); return; }
    setQrImageUrl(data.url); setNotice("QR terunggah. Periksa gambar, lalu simpan pengaturan pembayaran.");
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ paymentMode: mode, manualQrImageUrl: qrImageUrl, manualWhatsapp: whatsapp }) }).catch(() => null);
    const data = await response?.json().catch(() => null) as { payment?: PaymentSettings; error?: string } | null;
    setBusy(false);
    if (!response?.ok || !data?.payment) { setError(data?.error ?? "Pengaturan pembayaran belum tersimpan."); return; }
    setMode(data.payment.mode); setWhatsapp(data.payment.whatsapp); setQrImageUrl(data.payment.qrImageUrl); setReady(data.payment.ready);
    setNotice(data.payment.ready ? "Pembayaran tersimpan dan siap untuk order baru." : "Pengaturan tersimpan. Lengkapi QR dan WhatsApp agar pembayaran manual tersedia.");
  }

  return <section className="dashboard-content-card admin-settings-card admin-payment-settings">
    <div className="card-heading"><div><h2>Pembayaran pelanggan</h2><p>Atur QR tujuan dan kanal konfirmasi untuk order undangan, perpanjangan, serta kredit reseller.</p></div><QrCode size={19} /></div>
    <form className="admin-settings-form" onSubmit={save}>
      <label className="editor-field"><span className="field-label">Metode pembayaran</span><select className="text-input" value={mode} onChange={event => setMode(event.target.value as typeof mode)}><option value="manual">QR · verifikasi admin</option><option value="xendit">Gateway Xendit</option></select></label>
      {mode === "manual" && <>
        <label className="editor-field"><span className="field-label">QRIS pembayaran asli</span><input className="text-input" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || busy} onChange={event => void upload(event.target.files?.[0])} /><small><Upload size={13} /> {uploading ? "Mengunggah QR..." : "PNG, JPG, atau WebP maksimal 5 MB. Unggah QR tujuan yang sudah diperiksa pemilik usaha."}</small></label>
        {qrImageUrl && <div className="admin-payment-qr-preview"><Image src={qrImageUrl} alt="Pratinjau QR tujuan pembayaran" width={300} height={400} unoptimized /></div>}
        <label className="editor-field"><span className="field-label">WhatsApp konfirmasi pembayaran</span><input className="text-input" type="tel" inputMode="tel" value={whatsapp} onChange={event => setWhatsapp(event.target.value)} placeholder="08... atau 628..." /><small>Nomor ini ditautkan pada halaman pembayaran pelanggan.</small></label>
        <p className="admin-settings-note">Admin memverifikasi dana masuk di menu Order &amp; refund. Order lama tetap menggunakan QR dan WhatsApp yang tercatat saat order dibuat.</p>
        {!ready && <p className="admin-settings-note">Pembayaran manual tersedia setelah QR dan WhatsApp lengkap.</p>}
      </>}
      {mode === "xendit" && <p className="admin-settings-note">Mode gateway memerlukan konfigurasi Xendit pada deployment dan verifikasi alur pembayaran.</p>}
      {error && <p className="editor-error" role="alert">{error}</p>}{notice && <p className="admin-managed-success" role="status">{notice}</p>}
      <button className="button button--dark" disabled={busy || uploading} type="submit"><Save size={14} /> {busy ? "Menyimpan..." : "Simpan pembayaran"}</button>
    </form>
  </section>;
}
