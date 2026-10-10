"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";

type Submission = { id: string; slug: string; name: string; status: string; version: string; manifest?: unknown; updatedAt: string };

const exampleManifest = `{
  "slug": "garden-story",
  "version": "1.0.0",
  "schemaVersion": 1,
  "activationSku": "BASIC_ACTIVATION",
  "name": "Garden Story",
  "subtitle": "Botani dan hangat",
  "description": "Template bernuansa taman untuk hari yang terasa dekat.",
  "category": "Pernikahan",
  "price": 99000,
  "style": "sage",
  "tags": ["Botani", "Hangat"],
  "features": ["cover", "gallery", "gift-info", "maps", "music", "rsvp", "whatsapp-share"],
  "schema": {
    "schemaVersion": 1,
    "sections": [
      { "key": "identity", "label": "Informasi acara", "fields": [
        { "key": "eventTitle", "type": "text", "label": "Judul acara", "required": true },
        { "key": "hostOne", "type": "text", "label": "Nama pertama" },
        { "key": "hostTwo", "type": "text", "label": "Nama kedua" },
        { "key": "story", "type": "textarea", "label": "Cerita singkat" }
      ]},
      { "key": "schedule", "label": "Tanggal dan tempat", "fields": [
        { "key": "eventDate", "type": "datetime", "label": "Tanggal acara", "required": true },
        { "key": "eventTime", "type": "time", "label": "Waktu acara", "required": true },
        { "key": "venue", "type": "text", "label": "Nama tempat", "required": true },
        { "key": "address", "type": "textarea", "label": "Alamat", "required": true },
        { "key": "mapsUrl", "type": "url", "label": "Tautan peta" }
      ]},
      { "key": "media", "label": "Foto undangan", "fields": [
        { "key": "coverPhoto", "type": "image", "label": "Foto sampul", "aspectRatio": "3:4", "editable": true }
      ]}
    ]
  }
}`;

export function TemplateSubmissionForm() {
  const [manifest, setManifest] = useState(exampleManifest);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/developer/templates", { cache: "no-store" }).catch(() => null);
    const result = await response?.json().catch(() => null) as { templates?: Submission[]; error?: string } | null;
    setLoading(false);
    if (!response?.ok) {
      setError(result?.error ?? "Masuk dengan akun developer untuk melihat pengajuan.");
      return;
    }
    setError("");
    setSubmissions(result?.templates ?? []);
  }, []);

  useEffect(() => { void loadSubmissions(); }, [loadSubmissions]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    let value: unknown;
    try { value = JSON.parse(manifest); } catch { setBusy(false); setError("JSON manifest belum valid."); return; }
    const response = await fetch("/api/developer/templates", { method: editingId ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...(editingId ? { templateId: editingId } : {}), manifest: value }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; template?: Submission } | null;
    setBusy(false);
    if (!response?.ok || !result?.template) { setError(result?.error ?? "Template belum dapat diajukan."); return; }
    const submittedTemplate = result.template;
    setMessage(editingId ? "Versi baru dikirim ke antrean review. Versi aktif tetap tersedia sampai versi baru disetujui." : "Manifest dikirim ke antrean review admin. Template belum tampil di katalog sampai disetujui.");
    setSubmissions((current) => editingId
      ? current.map((submission) => submission.id === editingId ? { ...submittedTemplate, manifest: value } : submission)
      : [{ ...submittedTemplate, manifest: value }, ...current]);
    setEditingId(null);
  }

  function editSubmission(submission: Submission) {
    if (!["DRAFT", "UPDATE_DRAFT", "PUBLISHED"].includes(submission.status) || !submission.manifest) return;
    setEditingId(submission.id);
    setManifest(JSON.stringify(submission.manifest, null, 2));
    setError("");
    setMessage("");
    document.getElementById("submit-template")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEdit() {
    setEditingId(null);
    setManifest(exampleManifest);
    setError("");
    setMessage("");
  }

  return <section className="developer-submit-card" id="submit-template">
    <div className="developer-submit-heading"><div><span className="eyebrow">MARKETPLACE DEVELOPER</span><h2>Ajukan template ke review</h2><p>Akun dengan peran <code>TEMPLATE_DEVELOPER</code> dapat mengirim manifest JSON. Admin meninjau dan menerbitkan versi sebelum masuk katalog.</p></div><Send size={18} /></div>
    <form className="developer-submit-form" onSubmit={submit}>
      <label><span>Manifest JSON</span><textarea spellCheck={false} value={manifest} onChange={(event) => setManifest(event.target.value)} rows={22} aria-label="Manifest template JSON" /></label>
      {error && <p className="developer-submit-error" role="alert">{error}</p>}
      {message && <p className="developer-submit-success" role="status"><CheckCircle2 size={14} /> {message}</p>}
      <div className="developer-submit-actions"><button type="submit" className="button button--dark" disabled={busy}>{busy ? <><LoaderCircle size={14} className="is-spinning" /> Mengirim…</> : <>{editingId ? "Kirim versi baru ke review" : "Kirim ke antrean review"} <Send size={14} /></>}</button>{editingId && <button type="button" className="button button--outline" onClick={cancelEdit} disabled={busy}>Batalkan perubahan</button>}</div>
    </form>
    <div className="developer-submission-list"><h3>Pengajuan akun ini</h3>{loading ? <p>Memuat pengajuan…</p> : submissions.length ? submissions.map((submission) => <div key={submission.id}><b>{submission.name}</b><span>{submission.slug} · v{submission.version}</span><small>{submission.status}</small>{["DRAFT", "UPDATE_DRAFT", "PUBLISHED"].includes(submission.status) && submission.manifest != null && <button type="button" className="text-link" onClick={() => editSubmission(submission)}>{submission.status === "PUBLISHED" ? "Ajukan versi baru" : "Muat untuk perbaikan"}</button>}</div>) : <p>{error ? "Masuk dengan akun developer yang sudah disetujui untuk melihat daftar ini." : "Belum ada pengajuan template."}</p>}</div>
  </section>;
}
