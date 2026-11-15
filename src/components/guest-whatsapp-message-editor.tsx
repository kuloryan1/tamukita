"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MessageCircle, Save } from "lucide-react";
import { GUEST_MESSAGE_MAX_LENGTH, GUEST_MESSAGE_TOKENS, guestMessageError, renderGuestWhatsAppMessage, WEDDING_GUEST_MESSAGE } from "@/lib/guest-whatsapp-message";
import styles from "./guest-whatsapp-message-editor.module.css";

type PreviewGuest = { id: string; name: string };
type MessageSettings = { messageTemplate?: string; defaultTemplate?: string; error?: string };

export function GuestWhatsAppMessageEditor({ invitationId, slug, eventTitle, guests, shares, template, onChange, onReady }: {
  invitationId: string;
  slug: string;
  eventTitle: string;
  guests: PreviewGuest[];
  shares: Record<string, { url: string }>;
  template: string;
  onChange: (template: string) => void;
  onReady: (ready: boolean) => void;
}) {
  const fieldId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [savedTemplate, setSavedTemplate] = useState("");
  const [defaultTemplate, setDefaultTemplate] = useState(WEDDING_GUEST_MESSAGE);
  const [previewGuestId, setPreviewGuestId] = useState("");
  const [origin, setOrigin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setOrigin(window.location.origin);
    setLoading(true); setError(""); onReady(false);
    void fetch(`/api/invitations/${encodeURIComponent(invitationId)}/guest-message?retry=${reloadKey}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json().catch(() => null) as MessageSettings | null;
        if (!response.ok || typeof result?.messageTemplate !== "string" || typeof result.defaultTemplate !== "string") {
          throw new Error(result?.error ?? "Pesan WhatsApp belum dapat dimuat.");
        }
        if (controller.signal.aborted) return;
        setSavedTemplate(result.messageTemplate); setDefaultTemplate(result.defaultTemplate);
        onChange(result.messageTemplate); onReady(true);
      })
      .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Pesan WhatsApp belum dapat dimuat."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [invitationId, onChange, onReady, reloadKey]);

  const validationError = guestMessageError(template);
  const dirty = template !== savedTemplate;
  const previewGuest = guests.find((guest) => guest.id === previewGuestId) ?? guests[0];
  const previewUrl = (previewGuest && shares[previewGuest.id]?.url)
    || `${origin || "https://tamukita.io"}/${encodeURIComponent(slug)}?g=[tautan-pribadi-tamu]`;
  const preview = renderGuestWhatsAppMessage(template, { name: previewGuest?.name ?? "Nama tamu", eventTitle, url: previewUrl });

  function insertToken(token: typeof GUEST_MESSAGE_TOKENS[number]) {
    const field = textareaRef.current;
    const start = field?.selectionStart ?? template.length;
    const end = field?.selectionEnd ?? start;
    const marker = `{${token}}`;
    onChange(`${template.slice(0, start)}${marker}${template.slice(end)}`);
    setNotice("");
    requestAnimationFrame(() => { field?.focus(); field?.setSelectionRange(start + marker.length, start + marker.length); });
  }

  async function saveMessage() {
    if (validationError || saving || loading) return;
    const submitted = template;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/guest-message`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ messageTemplate: submitted }),
      });
      const result = await response.json().catch(() => null) as MessageSettings | null;
      if (!response.ok || typeof result?.messageTemplate !== "string") throw new Error(result?.error ?? "Pesan WhatsApp belum tersimpan. Coba lagi.");
      onChange(result.messageTemplate); setSavedTemplate(result.messageTemplate);
      setNotice("Pesan WhatsApp tersimpan untuk undangan ini.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pesan WhatsApp belum tersimpan. Coba lagi.");
    } finally { setSaving(false); }
  }

  return <section className={styles.section} aria-labelledby={`${fieldId}-title`}>
    <div className={styles.heading}><MessageCircle size={18} /><div><h4 id={`${fieldId}-title`}>Pesan WhatsApp</h4><p>Sesuaikan pesan untuk semua tamu di undangan ini. Nama dan tautan pribadi terisi otomatis.</p></div></div>
    {loading ? <p role="status">Memuat pesan WhatsApp…</p> : <>
      <div className={styles.columns}>
        <div>
          <label className="editor-field" htmlFor={fieldId}><span className="field-label">Template pesan WhatsApp</span></label>
          <textarea ref={textareaRef} id={fieldId} className={`text-input text-area ${styles.textarea}`} rows={16} value={template} onChange={(event) => { onChange(event.target.value); setNotice(""); }} disabled={saving || !savedTemplate} maxLength={GUEST_MESSAGE_MAX_LENGTH} aria-describedby={`${fieldId}-help${validationError ? ` ${fieldId}-error` : ""}`} aria-invalid={Boolean(validationError)} />
          <fieldset className={styles.tokens}><legend className="sr-only">Sisipkan penanda pesan</legend>{GUEST_MESSAGE_TOKENS.map((token) => <button key={token} type="button" onClick={() => insertToken(token)} disabled={saving || !savedTemplate}>{`{${token}}`}</button>)}</fieldset>
          <p className={styles.help} id={`${fieldId}-help`}>Penanda diganti untuk setiap tamu. Baris baru dan format teks WhatsApp tetap dipertahankan.</p>
          <p className={styles.counter}>{template.length.toLocaleString("id-ID")} / 4.000 karakter</p>
          {validationError && <p className={styles.error} id={`${fieldId}-error`}>{validationError}</p>}
        </div>
        <div className={styles.preview}>
          <label className="editor-field" htmlFor={`${fieldId}-preview`}><span className="field-label">Pratinjau untuk tamu</span></label>
          <select id={`${fieldId}-preview`} className="text-input" value={previewGuest?.id ?? ""} onChange={(event) => setPreviewGuestId(event.target.value)}>{guests.length ? guests.map((guest) => <option key={guest.id} value={guest.id}>{guest.name}</option>) : <option value="">Nama tamu</option>}</select>
          <section className={styles.message} aria-label="Pratinjau pesan WhatsApp">{preview}</section>
          <p className={styles.help}>Tautan contoh akan diganti tautan pribadi saat menyiapkan tautan tamu.</p>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className="button button--dark button--small" onClick={() => void saveMessage()} disabled={saving || !savedTemplate || !dirty || Boolean(validationError)}><Save size={14} />{saving ? "Menyimpan pesan…" : "Simpan pesan WA"}</button>
        <button type="button" className="button button--outline button--small" disabled={saving || !savedTemplate} onClick={() => { onChange(defaultTemplate); setNotice(""); }}>Gunakan contoh</button>
        <span className={styles.help}>{!savedTemplate ? "Pesan belum dimuat." : dirty ? "Perubahan belum disimpan." : "Pesan tersimpan."}</span>
      </div>
      <p className={styles.help}>Teks yang sedang diedit dipakai tombol Kirim dan Salin pesan. Simpan agar tersedia saat halaman dibuka kembali.</p>
    </>}
    {error && <div className="editor-error" role="alert">{error}{!savedTemplate && <button type="button" className="button button--outline button--small" onClick={() => setReloadKey((key) => key + 1)}>Coba lagi</button>}</div>}
    {notice && <p className={styles.notice} role="status">{notice}</p>}
  </section>;
}
