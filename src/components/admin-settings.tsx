"use client";

import { useState, type FormEvent } from "react";
import { Save, ShieldCheck } from "lucide-react";

type Settings = { prices: { basicActivationIdr: number; premiumActivationIdr: number; customerActivationIdr: number; hostingRenewalIdr: number }; hostingTermDays: number; integrations: { label: string; configured: boolean }[] };
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

export function AdminSettings({ initial }: { initial: Settings }) {
  const [basic, setBasic] = useState(initial.prices.basicActivationIdr ? String(initial.prices.basicActivationIdr) : "");
  const [premium, setPremium] = useState(initial.prices.premiumActivationIdr ? String(initial.prices.premiumActivationIdr) : "");
  const [customerActivation, setCustomerActivation] = useState(String(initial.prices.customerActivationIdr));
  const [hostingRenewal, setHostingRenewal] = useState(String(initial.prices.hostingRenewalIdr));
  const [hostingTerm, setHostingTerm] = useState(String(initial.hostingTermDays));
  const [integrations, setIntegrations] = useState(initial.integrations);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ basicActivationIdr: Number(basic), premiumActivationIdr: Number(premium), customerActivationIdr: Number(customerActivation), hostingRenewalIdr: Number(hostingRenewal), hostingTermDays: Number(hostingTerm) }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null) as (Settings & { error?: string }) | null;
    setBusy(false);
    if (!response?.ok || !payload) { setError(payload?.error ?? "Harga belum berhasil disimpan."); return; }
    setBasic(String(payload.prices.basicActivationIdr));
    setPremium(String(payload.prices.premiumActivationIdr));
    setCustomerActivation(String(payload.prices.customerActivationIdr));
    setHostingRenewal(String(payload.prices.hostingRenewalIdr));
    setHostingTerm(String(payload.hostingTermDays));
    setIntegrations(payload.integrations);
    setNotice("Pengaturan tersimpan. Harga pada order yang sudah dibuat tidak berubah.");
  }

  return <div className="admin-settings-grid">
    <section className="dashboard-content-card admin-settings-card">
      <div className="card-heading"><div><h2>Harga dan masa hosting</h2><p>Pengaturan ini digunakan untuk checkout baru. Secret dan credential integrasi tetap berasal dari konfigurasi deployment.</p></div></div>
      <form className="admin-settings-form" onSubmit={save}>
        <label className="editor-field"><span className="field-label">Kredit aktivasi Basic (IDR per kredit)</span><input className="text-input" type="number" min="1000" max="2147483647" step="1000" value={basic} onChange={(event) => setBasic(event.target.value)} required /></label>
        <label className="editor-field"><span className="field-label">Kredit aktivasi Premium (IDR per kredit)</span><input className="text-input" type="number" min="1000" max="2147483647" step="1000" value={premium} onChange={(event) => setPremium(event.target.value)} required /></label>
        <label className="editor-field"><span className="field-label">Aktivasi undangan pelanggan (IDR per undangan)</span><input className="text-input" type="number" min="0" max="2147483647" step="1000" value={customerActivation} onChange={(event) => setCustomerActivation(event.target.value)} required /><small>Isi Rp0 untuk tetap memakai lisensi template saja tanpa biaya aktivasi tambahan.</small></label>
        <label className="editor-field"><span className="field-label">Harga perpanjangan hosting (IDR untuk satu periode)</span><input className="text-input" type="number" min="0" max="2147483647" step="1000" value={hostingRenewal} onChange={(event) => setHostingRenewal(event.target.value)} required /><small>Isi Rp0 untuk menonaktifkan checkout perpanjangan.</small></label>
        <label className="editor-field"><span className="field-label">Masa hosting untuk publikasi baru (hari)</span><input className="text-input" type="number" min="30" max="3650" step="1" value={hostingTerm} onChange={(event) => setHostingTerm(event.target.value)} required /></label>
        <p className="admin-settings-note">Nilai formulir: Basic {money(Number(basic) || 0)} · Premium {money(Number(premium) || 0)} · Aktivasi pelanggan {money(Number(customerActivation) || 0)} · Perpanjangan {Number(hostingRenewal) > 0 ? money(Number(hostingRenewal)) : "nonaktif"} / {hostingTerm || "—"} hari. Pengaturan database dipakai untuk order baru; order dan masa hosting yang sudah diterbitkan tetap memakai snapshot.</p>
        {error && <div className="editor-error" role="alert">{error}</div>}
        {notice && <div className="admin-managed-success" role="status">{notice}</div>}
        <button className="button button--dark" type="submit" disabled={busy || Number(basic) < 1000 || Number(premium) < 1000 || Number(customerActivation) < 0 || Number(hostingRenewal) < 0 || Number(hostingTerm) < 30}>{busy ? "Menyimpan..." : "Simpan pengaturan"} <Save size={14} /></button>
      </form>
    </section>
    <section className="dashboard-content-card admin-settings-card">
      <div className="card-heading"><div><h2>Status integrasi</h2><p>Hanya status konfigurasi yang terlihat. Nilai rahasia tidak ditampilkan di admin.</p></div><ShieldCheck size={17} /></div>
      <div className="admin-integration-list">{integrations.map((integration) => <div className="admin-integration-row" key={integration.label}><span>{integration.label}</span><b className={integration.configured ? "is-configured" : "is-missing"}>{integration.configured ? "Terpasang" : "Belum diatur"}</b></div>)}</div>
    </section>
  </div>;
}
