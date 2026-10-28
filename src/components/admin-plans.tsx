"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ChevronLeft, ChevronRight, Pencil, Plus, Save, X } from "lucide-react";

type PlanEntitlement = { featureKey: string; value: unknown };
type Plan = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  priceIdr: number;
  durationDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  grantCount: number;
  entitlements: PlanEntitlement[];
};
type PlanResponse = { page: number; pageSize: number; total: number; plans: Plan[]; error?: string };
type PlanForm = { key: string; name: string; description: string; priceIdr: string; durationDays: string; isActive: boolean; entitlements: string };

const emptyForm: PlanForm = { key: "", name: "", description: "", priceIdr: "0", durationDays: "365", isActive: false, entitlements: "{}" };
const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);

function entitlementObject(entitlements: PlanEntitlement[]) {
  return Object.fromEntries(entitlements.map(({ featureKey, value }) => [featureKey, value]));
}

export function AdminPlans({ initial }: { initial: PlanResponse }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(initial);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const resultRequestId = useRef(0);

  useEffect(() => {
    const requestId = ++resultRequestId.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: query, page: String(page) });
        const response = await fetch(`/api/admin/plans?${params}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json().catch(() => null) as PlanResponse | null;
        if (!response.ok || !payload) throw new Error(payload?.error ?? "Katalog paket belum dapat dimuat.");
        if (requestId === resultRequestId.current) setResult(payload);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (requestId === resultRequestId.current) setError(caught instanceof Error ? caught.message : "Katalog paket belum dapat dimuat.");
      } finally {
        if (!controller.signal.aborted && requestId === resultRequestId.current) setLoading(false);
      }
    }, 180);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, page]);

  function startEdit(plan: Plan) {
    setEditing(plan);
    setForm({
      key: plan.key,
      name: plan.name,
      description: plan.description ?? "",
      priceIdr: String(plan.priceIdr),
      durationDays: String(plan.durationDays),
      isActive: plan.isActive,
      entitlements: JSON.stringify(entitlementObject(plan.entitlements), null, 2),
    });
    setError("");
    setNotice("");
  }

  function resetForm() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setNotice("");
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    let entitlementValues: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(form.entitlements);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Gunakan object JSON, misalnya {\"gallery.limit\":6,\"music\":true}.");
      entitlementValues = parsed as Record<string, unknown>;
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : "Format entitlement harus JSON yang valid.");
      return;
    }

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      priceIdr: Number(form.priceIdr),
      durationDays: Number(form.durationDays),
      entitlements: Object.entries(entitlementValues).map(([featureKey, value]) => ({ featureKey, value })),
      ...(editing ? { expectedUpdatedAt: editing.updatedAt, isActive: form.isActive } : { key: form.key.trim() }),
    };
    const response = await fetch(editing ? `/api/admin/plans/${encodeURIComponent(editing.id)}` : "/api/admin/plans", {
      method: editing ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const payload = await response?.json().catch(() => null) as { plan?: Plan; error?: string } | null;
    setBusy(false);
    if (!response?.ok || !payload?.plan) {
      setError(payload?.error ?? "Paket belum berhasil disimpan.");
      return;
    }
    resultRequestId.current += 1;
    setLoading(false);
    setNotice(editing ? "Paket diperbarui dan dicatat di audit log." : payload.plan.isActive ? "Paket dibuat aktif dan dicatat di audit log." : "Paket dibuat nonaktif dan dicatat di audit log.");
    const savedPlan = payload.plan;
    setEditing(savedPlan);
    setForm((current) => ({ ...current, key: savedPlan.key, entitlements: JSON.stringify(entitlementObject(savedPlan.entitlements), null, 2) }));
    setResult((current) => {
      const plans = editing
        ? current.plans.map((plan) => plan.id === savedPlan.id ? savedPlan : plan)
        : [savedPlan, ...current.plans.filter((plan) => plan.id !== savedPlan.id)].slice(0, current.pageSize);
      return { ...current, total: current.total + (editing ? 0 : 1), page: 1, plans };
    });
    if (!editing) { setQuery(""); setPage(1); }
  }

  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));

  return <div className="admin-settings-grid admin-plans-grid">
    <section className="dashboard-content-card admin-settings-card">
      <div className="card-heading"><div><h2>Katalog paket</h2><p>{result.total.toLocaleString("id-ID")} paket · nilai entitlement tersimpan sebagai JSON.</p></div></div>
      <label className="admin-search"><span className="sr-only">Cari paket</span><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Cari nama atau kode paket" aria-label="Cari paket" /></label>
      {error && !editing && <div className="editor-error" role="alert">{error}</div>}
      {loading && !result.plans.length ? <div className="dashboard-empty-state"><p>Memuat katalog paket…</p></div> : result.plans.length ? <>
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Paket</th><th>Harga / masa</th><th>Status</th><th>Entitlement</th><th>Aksi</th></tr></thead><tbody>{result.plans.map((plan) => <tr key={plan.id} data-testid={`admin-plan-row-${plan.id}`}>
          <td><b>{plan.name}</b><small><code>{plan.key}</code></small></td>
          <td>{money(plan.priceIdr)}<small>{plan.durationDays} hari</small></td>
          <td>{plan.isActive ? <span className="admin-plan-status--active">Aktif</span> : <span className="admin-plan-status--inactive">Nonaktif</span>}<small>{plan.grantCount} hak pernah diberikan</small></td>
          <td>{plan.entitlements.length ? plan.entitlements.map(({ featureKey }) => <code className="admin-plan-feature" key={featureKey}>{featureKey}</code>) : <small>Belum ada</small>}</td>
          <td><button className="button button--outline button--small" type="button" onClick={() => startEdit(plan)} aria-label={`Edit paket ${plan.name}`}><Pencil size={13} /> Edit</button></td>
        </tr>)}</tbody></table></div>
        <div className="admin-pagination"><span>Halaman {page} dari {pageCount}</span><div><button className="button button--outline button--small" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} aria-label="Halaman sebelumnya"><ChevronLeft size={15} /></button><button className="button button--outline button--small" type="button" disabled={page >= pageCount || loading} onClick={() => setPage((current) => current + 1)} aria-label="Halaman berikutnya"><ChevronRight size={15} /></button></div></div>
      </> : <div className="dashboard-empty-state"><h3>{query ? "Paket tidak ditemukan" : "Belum ada paket"}</h3><p>{query ? "Coba nama atau kode lain." : "Buat paket setelah harga, masa berlaku, dan fitur yang ditawarkan disetujui."}</p></div>}
    </section>

    <section className="dashboard-content-card admin-settings-card">
      <div className="card-heading"><div><h2>{editing ? "Edit paket" : "Buat paket"}</h2><p>Kode paket tidak dapat diubah setelah disimpan. Paket baru selalu dimulai nonaktif.</p></div>{editing ? <button className="button button--outline button--small" type="button" onClick={resetForm} aria-label="Tutup editor paket"><X size={14} /></button> : <Plus size={17} />}</div>
      <form className="admin-settings-form" onSubmit={save}>
        <label className="editor-field"><span className="field-label">Kode paket</span><input className="text-input" value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} placeholder="contoh: paket-basic" pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,47}" maxLength={48} readOnly={Boolean(editing)} required /></label>
        <label className="editor-field"><span className="field-label">Nama paket</span><input className="text-input" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={80} required /></label>
        <label className="editor-field"><span className="field-label">Deskripsi</span><textarea className="text-input" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={500} rows={3} /></label>
        <label className="editor-field"><span className="field-label">Harga (IDR)</span><input className="text-input" type="number" value={form.priceIdr} onChange={(event) => setForm((current) => ({ ...current, priceIdr: event.target.value }))} min={0} max={2147483647} step={1000} required /></label>
        <label className="editor-field"><span className="field-label">Masa berlaku (hari)</span><input className="text-input" type="number" value={form.durationDays} onChange={(event) => setForm((current) => ({ ...current, durationDays: event.target.value }))} min={1} max={3650} step={1} required /></label>
        <label className="editor-field"><span className="field-label">Entitlement per feature key (JSON)</span><textarea className="text-input" value={form.entitlements} onChange={(event) => setForm((current) => ({ ...current, entitlements: event.target.value }))} rows={7} spellCheck={false} aria-label="Entitlement JSON" /><small>Contoh: {`{"gallery.limit":6,"music":true}`}. Batas 32 fitur dan nilai JSON kecil.</small></label>
        <label className="editor-field admin-plan-active"><input type="checkbox" checked={form.isActive} disabled={!editing} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} /><span className="field-label">{editing ? "Tandai paket aktif" : "Aktifkan setelah paket ditinjau"}</span></label>
        {error && <div className="editor-error" role="alert">{error}</div>}
        {notice && <div className="admin-managed-success" role="status">{notice}</div>}
        <p className="admin-settings-note">Katalog ini belum menjadi pilihan checkout. Saat ini biaya aktivasi dan hosting masih memakai Pengaturan platform. Mengarsipkan paket tidak menghapus hak yang sudah pernah diberikan.</p>
        <div className="admin-plan-form-actions"><button className="button button--dark" type="submit" disabled={busy}>{busy ? "Menyimpan…" : editing ? "Simpan perubahan" : "Buat paket"} {editing ? <Save size={14} /> : <Check size={14} />}</button>{editing && <button className="button button--outline button--small" type="button" onClick={resetForm} disabled={busy}>Batal</button>}</div>
      </form>
    </section>
  </div>;
}
