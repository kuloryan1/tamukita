"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Check, RotateCcw, Save, Undo2 } from "lucide-react";
import { formatRupiah } from "@/lib/templates";

type AdminTemplateRow = { id: string; slug: string; name: string; description: string; category: string; status: string; licenseType: string; priceIdr: number; proposedPrice: number | null; version: string; author: string; sourceRef: string | null; sdkVersion: string | null; updatedAt: string };
type Props = { templates: AdminTemplateRow[]; canSetPricing: boolean };

function actionLabel(status: string) {
  if (status === "IN_REVIEW") return "Menunggu review";
  if (status === "UPDATE_IN_REVIEW") return "Versi baru menunggu review";
  if (status === "UPDATE_DRAFT") return "Perubahan diminta";
  if (status === "ARCHIVED") return "Diarsipkan";
  if (status === "PUBLISHED") return "Terbit";
  return status;
}

export function AdminTemplateReview({ templates, canSetPricing }: Props) {
  const router = useRouter();
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(templates.map((template) => [template.id, String(template.priceIdr)])));
  const [licenses, setLicenses] = useState<Record<string, string>>(() => Object.fromEntries(templates.map((template) => [template.id, template.licenseType])));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function apply(id: string, action: string, details?: Record<string, unknown>) {
    setBusy(`${id}:${action}`);
    setError("");
    setNotice("");
    const response = await fetch(`/api/admin/templates/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, ...details }),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null) as { error?: string } | null;
    setBusy("");
    if (!response?.ok) {
      setError(payload?.error ?? "Perubahan template belum tersimpan.");
      return;
    }
    setNotice("Perubahan template tersimpan dan tercatat di audit admin.");
    router.refresh();
  }

  return <section className="dashboard-content-card admin-template-review-card">
    <div className="card-heading"><div><h2>Template, review, dan harga</h2><p>Publikasi versi harus lolos validasi manifest. Perubahan harga hanya memengaruhi order baru; order yang sudah dibuat tetap memakai snapshot harga.</p></div></div>
    {templates.length ? <div className="admin-template-list">{templates.map((template) => <article className="admin-template-row" key={template.id}>
      <div className="admin-template-summary"><span className={`admin-template-status admin-template-status--${template.status.toLowerCase()}`}>{actionLabel(template.status)}</span><h3>{template.name}</h3><p>{template.category} · {template.slug} · v{template.version}</p><small>{template.author} · diperbarui {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(template.updatedAt))}</small>{template.sourceRef && <small>Sumber: {template.sourceRef}{template.sdkVersion ? ` · SDK ${template.sdkVersion}` : ""}</small>}<p className="admin-template-description">{template.description}</p></div>
      <div className="admin-template-actions">
        {(template.status === "IN_REVIEW" || template.status === "UPDATE_IN_REVIEW") && <><button className="button button--outline button--small" type="button" disabled={busy.startsWith(`${template.id}:`)} onClick={() => void apply(template.id, "request_changes")}><Undo2 size={13} /> Minta perubahan</button><button className="button button--dark button--small" type="button" disabled={busy.startsWith(`${template.id}:`)} onClick={() => void apply(template.id, "publish")}><Check size={13} /> {template.status === "UPDATE_IN_REVIEW" ? "Terapkan versi baru" : "Terbitkan"}</button></>}
        {(template.status === "PUBLISHED" || template.status === "UPDATE_DRAFT") && <>
          {canSetPricing && <div className="admin-template-pricing"><label><span>Lisensi</span><select value={licenses[template.id] ?? template.licenseType} onChange={(event) => setLicenses((current) => ({ ...current, [template.id]: event.target.value }))}><option value="PAID_PER_INVITATION">Berbayar</option><option value="FREE">Gratis</option></select></label><label><span>Harga (IDR)</span><input type="number" min="0" max="100000000" step="1000" value={prices[template.id] ?? String(template.priceIdr)} onChange={(event) => setPrices((current) => ({ ...current, [template.id]: event.target.value }))} /></label><button className="button button--outline button--small" type="button" disabled={busy.startsWith(`${template.id}:`)} onClick={() => void apply(template.id, "set_pricing", { licenseType: licenses[template.id] ?? template.licenseType, priceIdr: Number(prices[template.id] ?? template.priceIdr) })}><Save size={13} /> Simpan harga</button></div>}
          <button className="button button--outline button--small" type="button" disabled={busy.startsWith(`${template.id}:`)} onClick={() => { if (window.confirm(`Arsipkan template ${template.name}? Undangan lama tetap memakai versi tersimpan.`)) void apply(template.id, "archive"); }}><Archive size={13} /> Arsipkan</button>
        </>}
        {template.status === "ARCHIVED" && <button className="button button--outline button--small" type="button" disabled={busy.startsWith(`${template.id}:`)} onClick={() => void apply(template.id, "restore")}><RotateCcw size={13} /> Pulihkan ke katalog</button>}
        {template.status === "IN_REVIEW" && <span className="admin-template-price">Harga diajukan: {formatRupiah(template.priceIdr)}</span>}
        {template.status === "UPDATE_IN_REVIEW" && <span className="admin-template-price">Template aktif tetap tersedia · Harga versi baru: {template.proposedPrice === null ? "tidak diubah" : formatRupiah(template.proposedPrice)}</span>}
        {template.status === "UPDATE_DRAFT" && <span className="admin-template-price">Versi aktif tetap tersedia di katalog.</span>}
      </div>
    </article>)}</div> : <div className="dashboard-empty-state"><h3>Belum ada template dalam antrean</h3><p>Template yang diajukan developer akan tampil di sini.</p></div>}
    {error && <div className="editor-error" role="alert">{error}</div>}
    {notice && <p className="admin-managed-success" role="status">{notice}</p>}
  </section>;
}
