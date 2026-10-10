"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { EVENT_KINDS, EVENT_KIND_TITLE_SUGGESTIONS, familyDetailsPrompt, type EventKind } from "@/lib/invitations";

type TemplateOption = { slug: string; name: string; version: string };
type DraftForm = {
  eventKind: EventKind;
  eventTitle: string;
  hostOne: string;
  hostTwo: string;
  familyDetails: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  address: string;
  mapsUrl: string;
  story: string;
  templateId: string;
  templateVersion: string;
  slug: string;
  coverPhoto: string;
  coverPosition: number;
  coverPositionX: number;
  galleryPhotos: string[];
  giftMessage: string;
  giftBankName: string;
  giftAccountName: string;
  giftAccountNumber: string;
  musicUrl: string;
  musicTitle: string;
};

export function AdminManagedInvitation({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();
  const firstTemplate = templates[0];
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [draft, setDraft] = useState<DraftForm>({
    eventKind: "Pernikahan",
    eventTitle: "",
    hostOne: "",
    hostTwo: "",
    familyDetails: "",
    eventDate: "",
    eventTime: "09:00",
    venue: "",
    address: "",
    mapsUrl: "",
    story: "",
    templateId: firstTemplate.slug,
    templateVersion: firstTemplate.version,
    slug: "",
    coverPhoto: "",
    coverPosition: 50,
    coverPositionX: 50,
    galleryPhotos: [],
    giftMessage: "",
    giftBankName: "",
    giftAccountName: "",
    giftAccountNumber: "",
    musicUrl: "",
    musicTitle: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const familyPrompt = familyDetailsPrompt(draft.eventKind);

  function update<K extends keyof DraftForm>(key: K, value: DraftForm[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function changeEventKind(kind: EventKind) {
    setDraft((current) => {
      const titleWasSuggested = !current.eventTitle.trim()
        || Object.values(EVENT_KIND_TITLE_SUGGESTIONS).includes(current.eventTitle);
      return {
        ...current,
        eventKind: kind,
        eventTitle: kind === "Pernikahan" || !titleWasSuggested
          ? current.eventTitle
          : EVENT_KIND_TITLE_SUGGESTIONS[kind],
      };
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setSuccess("");
    const response = await fetch("/api/admin/invitations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customerName, customerEmail, draft }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; customerCreated?: boolean; onboardingEmailSent?: boolean; invitationNotificationQueued?: boolean; invitation?: { title: string; slug: string } } | null;
    setBusy(false);
    if (!response?.ok || !result?.invitation) { setError(result?.error ?? "Draft belum berhasil dibuat."); return; }
    const onboardingMessage = result.customerCreated
      ? result.onboardingEmailSent
        ? " Akun pelanggan dibuat dan tautan pengaturan kata sandi telah dikirim ke emailnya."
        : " Akun pelanggan dibuat, tetapi email pengaturan kata sandi belum terkirim. Minta pelanggan memakai fitur lupa kata sandi setelah email dikonfigurasi."
      : result.invitationNotificationQueued
        ? " Draft masuk ke dashboard akun pelanggan dan email pemberitahuan sudah masuk antrean pengiriman."
        : " Draft masuk ke dashboard akun pelanggan.";
    setSuccess(`Draft “${result.invitation.title}” dengan tautan tamukita.io/${result.invitation.slug} dibuat.${onboardingMessage}`);
    setCustomerEmail("");
    setCustomerName("");
    router.refresh();
  }

  return <section className="dashboard-content-card admin-managed-card"><div className="card-heading"><div><h2>Buat undangan untuk pelanggan</h2><p>Draft dibuat atas nama pelanggan. Pelanggan dapat melanjutkan edit dan pembayaran dari dashboard mereka.</p></div></div>
    <form className="admin-managed-form" onSubmit={submit}>
      <label className="editor-field"><span className="field-label">Nama pelanggan</span><input className="text-input" required minLength={2} maxLength={80} value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder="Nama lengkap" /></label>
      <label className="editor-field"><span className="field-label">Email akun pelanggan</span><input className="text-input" type="email" required maxLength={254} value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="nama@email.com" /></label>
      <label className="editor-field"><span className="field-label">Template</span><select className="text-input" value={draft.templateId} onChange={(event) => { const template = templates.find((item) => item.slug === event.target.value); if (template) setDraft((current) => ({ ...current, templateId: template.slug, templateVersion: template.version })); }}>{templates.map((template) => <option key={template.slug} value={template.slug}>{template.name}</option>)}</select></label>
      <label className="editor-field"><span className="field-label">Jenis acara</span><select className="text-input" value={draft.eventKind} onChange={(event) => changeEventKind(event.target.value as EventKind)}>{EVENT_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}</select></label>
      {draft.eventKind === "Pernikahan" ? <><label className="editor-field"><span className="field-label">Nama pertama</span><input className="text-input" required maxLength={80} value={draft.hostOne} onChange={(event) => update("hostOne", event.target.value)} /></label><label className="editor-field"><span className="field-label">Nama kedua</span><input className="text-input" required maxLength={80} value={draft.hostTwo} onChange={(event) => update("hostTwo", event.target.value)} /></label></> : <label className="editor-field admin-managed-field--wide"><span className="field-label">Judul acara</span><input className="text-input" required maxLength={120} value={draft.eventTitle} onChange={(event) => update("eventTitle", event.target.value)} /></label>}
      <label className="editor-field admin-managed-field--wide"><span className="field-label">{familyPrompt.label}</span><textarea className="text-input" maxLength={600} rows={2} value={draft.familyDetails} onChange={(event) => update("familyDetails", event.target.value)} placeholder={familyPrompt.placeholder} /><span className="field-hint">Informasi ini akan ditampilkan di undangan publik.</span></label>
      <label className="editor-field"><span className="field-label">Tanggal</span><input className="text-input" type="date" required value={draft.eventDate} onChange={(event) => update("eventDate", event.target.value)} /></label>
      <label className="editor-field"><span className="field-label">Waktu</span><input className="text-input" type="time" required value={draft.eventTime} onChange={(event) => update("eventTime", event.target.value)} /></label>
      <label className="editor-field"><span className="field-label">Tempat acara</span><input className="text-input" required maxLength={160} value={draft.venue} onChange={(event) => update("venue", event.target.value)} /></label>
      <label className="editor-field admin-managed-field--wide"><span className="field-label">Alamat lengkap</span><textarea className="text-input" required maxLength={1000} rows={3} value={draft.address} onChange={(event) => update("address", event.target.value)} /></label>
      <label className="editor-field admin-managed-field--wide"><span className="field-label">Tautan Google Maps (opsional)</span><input className="text-input" type="url" maxLength={2000} value={draft.mapsUrl} onChange={(event) => update("mapsUrl", event.target.value)} placeholder="https://maps.google.com/..." /></label>
      <label className="editor-field admin-managed-field--wide"><span className="field-label">Tautan undangan</span><div className="admin-managed-slug"><span>tamukita.io/</span><input className="text-input" required minLength={3} maxLength={48} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={draft.slug} onChange={(event) => update("slug", event.target.value.toLowerCase())} placeholder="nama-acara" /></div></label>
      <label className="editor-field admin-managed-field--wide"><span className="field-label">Cerita singkat (opsional)</span><textarea className="text-input" maxLength={3000} rows={3} value={draft.story} onChange={(event) => update("story", event.target.value)} /></label>
      {error && <div className="editor-error admin-managed-message" role="alert">{error}</div>}
      {success && <div className="admin-managed-success" role="status"><CheckCircle2 size={15} />{success}</div>}
      <div className="admin-managed-submit"><span>Foto sampul dapat ditambahkan pelanggan di editornya.</span><button className="button button--dark" type="submit" disabled={busy}>{busy ? "Membuat draft..." : "Buat draft pelanggan"} <ArrowRight size={15} /></button></div>
    </form>
  </section>;
}
