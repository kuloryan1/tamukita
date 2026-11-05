"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { WeddingTemplate } from "@/lib/stationery-demo";
import { GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_COPY, RSVP_CHILD_DATA_GUARDIAN_CONSENT_COPY } from "@/lib/consent-copy";

type Attendance = "yes" | "no" | "maybe";
type Draft = {
  name: string;
  attendance: Attendance | "";
  guests: number;
  message: string;
  includesChildData: boolean;
  guardianConsent: boolean;
  website: string;
};
type DemoSubmission = Omit<Draft, "website" | "attendance"> & {
  version: 1;
  template: string;
  attendance: Attendance;
  updatedAt: string;
};
type FieldErrors = Record<string, string>;
const STORAGE_PREFIX = "tamukita:stationery-demo:rsvp:v1:";
const attendanceLabels: Record<Attendance, string> = { yes: "Akan hadir", no: "Berhalangan", maybe: "Belum pasti" };
const characterCount = (value: string) => Array.from(value).length;

function containsControlCharacters(value: string, allowTextWhitespace = false): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined) continue;
    if (codePoint === 127) return true;
    if (codePoint < 32 && !(allowTextWhitespace && (codePoint === 9 || codePoint === 10 || codePoint === 13))) return true;
  }
  return false;
}

function blankDraft(recipient: string): Draft {
  return { name: recipient === "Anda" ? "" : recipient, attendance: "", guests: 1, message: "", includesChildData: false, guardianConsent: false, website: "" };
}

function draftFromSubmission(value: DemoSubmission): Draft {
  return { name: value.name, attendance: value.attendance, guests: value.guests || 1, message: value.message, includesChildData: value.includesChildData, guardianConsent: value.guardianConsent, website: "" };
}

function validateDraft(draft: Draft, requireGuestbookMessage = false): FieldErrors {
  const fields: FieldErrors = {};
  const name = draft.name.trim();
  if (!name.replace(/[\s\u200b-\u200d\ufeff]/gu, "") || characterCount(name) > 100 || containsControlCharacters(name)) {
    fields.name = "Isi nama Anda, maksimal 100 karakter.";
  }
  if (draft.attendance !== "yes" && draft.attendance !== "no" && draft.attendance !== "maybe") fields.attendance = "Pilih salah satu konfirmasi kehadiran.";
  if (draft.attendance === "yes" && (!Number.isInteger(draft.guests) || draft.guests < 1 || draft.guests > 5)) fields.guests = "Jumlah tamu harus antara 1 dan 5 orang.";
  if (characterCount(draft.message.trim()) > 500 || containsControlCharacters(draft.message, true)) fields.message = "Ucapan maksimal 500 karakter.";
  if (requireGuestbookMessage && draft.message.trim().length === 1) fields.message = "Ucapan perlu berisi minimal 2 karakter.";
  if (draft.includesChildData !== draft.guardianConsent) fields.guardianConsent = "Persetujuan orang tua/wali diperlukan jika jawaban mencantumkan data anak.";
  if (draft.website.trim()) fields.website = "Formulir tidak valid. Silakan coba kembali.";
  return fields;
}

function readSavedReply(raw: string, template: string): DemoSubmission | null {
  if (raw.length > 16_384) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const item = value as Record<string, unknown>;
    if (item.version !== 1 || item.template !== template || typeof item.name !== "string" || typeof item.message !== "string" || typeof item.guests !== "number" || typeof item.includesChildData !== "boolean" || typeof item.guardianConsent !== "boolean" || typeof item.updatedAt !== "string" || !Number.isFinite(Date.parse(item.updatedAt)) || (item.attendance !== "yes" && item.attendance !== "no" && item.attendance !== "maybe")) return null;
    const candidate: Draft = { name: item.name, attendance: item.attendance, guests: item.guests, message: item.message, includesChildData: item.includesChildData, guardianConsent: item.guardianConsent, website: "" };
    if (Object.keys(validateDraft(candidate)).length !== 0) return null;
    return { version: 1, template, name: candidate.name.trim(), attendance: item.attendance, guests: item.attendance === "yes" ? candidate.guests : 0, message: candidate.message.trim(), includesChildData: candidate.includesChildData, guardianConsent: candidate.guardianConsent, updatedAt: item.updatedAt };
  } catch {
    return null;
  }
}

function CheckMark() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12 4 4 8-8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function RSVP({ template, recipient, isTestableSample = false, slug, guestToken }: {
  template: WeddingTemplate;
  recipient: string;
  isTestableSample?: boolean;
  slug?: string;
  guestToken?: string;
}) {
  const id = useId();
  const recipientRef = useRef(recipient);
  recipientRef.current = recipient;
  const formRef = useRef<HTMLFormElement>(null);
  const savedHeadingRef = useRef<HTMLHeadingElement>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [submission, setSubmission] = useState<DemoSubmission | null>(null);
  const [draft, setDraft] = useState<Draft>(() => blankDraft(recipient));
  const [editing, setEditing] = useState(true);
  const [busy, setBusy] = useState<"" | "saving" | "deleting">("");
  const [error, setError] = useState("");
  const [fields, setFields] = useState<FieldErrors>({});
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [storageWarning, setStorageWarning] = useState("");
  const [persisted, setPersisted] = useState(false);
  const [hasStoredReply, setHasStoredReply] = useState(false);
  const [guestbookIncludesChildData, setGuestbookIncludesChildData] = useState(false);
  const [guestbookGuardianConsent, setGuestbookGuardianConsent] = useState(false);
  const storageKey = `${STORAGE_PREFIX}${template.slug}`;

  const loadReply = useCallback(() => {
    setLoading(true);
    setLoadError("");
    setError("");
    setFields({});
    setNotice("");
    setConfirmDelete(false);
    setPersisted(false);
    setHasStoredReply(false);
    setSubmission(null);
    setDraft(blankDraft(recipientRef.current));
    setEditing(true);
    setGuestbookIncludesChildData(false);
    setGuestbookGuardianConsent(false);
    if (isTestableSample) {
      setStorageAvailable(true);
      setStorageWarning("");
      setLoading(false);
      return;
    }
    let raw: string | null;
    try {
      raw = window.sessionStorage.getItem(`${STORAGE_PREFIX}${template.slug}`);
      setStorageAvailable(true);
      setStorageWarning("");
    } catch {
      setStorageAvailable(false);
      setStorageWarning("Penyimpanan tab tidak tersedia. Jawaban baru hanya akan tampil sementara dan hilang saat halaman dimuat ulang.");
      setLoading(false);
      return;
    }
    if (raw !== null) {
      setHasStoredReply(true);
      const saved = readSavedReply(raw, template.slug);
      if (saved) {
        setSubmission(saved);
        setDraft(draftFromSubmission(saved));
        setEditing(false);
        setPersisted(true);
      } else {
        setLoadError("Jawaban percobaan sebelumnya tidak dapat dibaca. Coba muat lagi atau isi jawaban baru untuk menggantikannya saat Anda menyimpan.");
      }
    }
    setLoading(false);
  }, [isTestableSample, template.slug]);

  useEffect(() => { loadReply(); }, [loadReply]);

  function startNewReply() {
    setLoadError("");
    setDraft(blankDraft(recipientRef.current));
    setGuestbookIncludesChildData(false);
    setGuestbookGuardianConsent(false);
    setSubmission(null);
    setEditing(true);
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus({ preventScroll: true }));
  }

  function focusFirstError(errors: FieldErrors) {
    const key = ["name", "attendance", "guests", "message", "guardianConsent", "guestbookGuardianConsent"].find((field) => errors[field]);
    if (key) requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>(`[name="${key}"]`)?.focus());
  }

  function changeField<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setFields((previous) => ({ ...previous, [key]: "" }));
  }

  function changeChildData(selected: boolean) {
    setDraft((previous) => ({ ...previous, includesChildData: selected, guardianConsent: false }));
    setFields((previous) => ({ ...previous, guardianConsent: "" }));
    setError("");
  }

  function changeGuestbookChildData(selected: boolean) {
    setGuestbookIncludesChildData(selected);
    setGuestbookGuardianConsent(false);
    setFields((previous) => ({ ...previous, guestbookGuardianConsent: "" }));
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setNotice("");
    const errors = validateDraft(draft, isTestableSample);
    if (Object.keys(errors).length !== 0) {
      setFields(errors);
      setError(errors.website || "Periksa kembali kolom yang ditandai.");
      focusFirstError(errors);
      return;
    }
    if (isTestableSample && draft.message.trim() && guestbookIncludesChildData !== guestbookGuardianConsent) {
      const guestbookConsentError = "Persetujuan orang tua/wali diperlukan jika ucapan mencantumkan data anak.";
      setFields((previous) => ({ ...previous, guestbookGuardianConsent: guestbookConsentError }));
      setError(guestbookConsentError);
      focusFirstError({ guestbookGuardianConsent: guestbookConsentError });
      return;
    }
    setBusy("saving");
    setFields({});
    const saved: DemoSubmission = { version: 1, template: template.slug, name: draft.name.trim(), attendance: draft.attendance as Attendance, guests: draft.attendance === "yes" ? draft.guests : 0, message: draft.message.trim(), includesChildData: draft.includesChildData, guardianConsent: draft.guardianConsent, updatedAt: new Date().toISOString() };
    if (isTestableSample) {
      const response = await fetch(`/api/public/invitations/${encodeURIComponent(slug || "")}/rsvp`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: saved.name,
          ...(guestToken ? { guestToken } : {}),
          attendance: saved.attendance === "yes" ? "ATTENDING" : saved.attendance === "no" ? "DECLINED" : "MAYBE",
          attendeeCount: saved.guests || 1,
          includesChildData: saved.includesChildData,
          guardianConsent: saved.guardianConsent,
          ...(saved.message ? { message: saved.message, guestbookIncludesChildData, guestbookGuardianConsent } : {}),
        }),
      }).catch(() => null);
      const result = await response?.json().catch(() => null) as { error?: string } | null;
      if (!response?.ok) {
        setError(result?.error ?? "Konfirmasi kehadiran belum dapat dikirim. Periksa koneksi dan coba lagi.");
        setBusy("");
        return;
      }
      setNotice(saved.message ? "Konfirmasi terkirim. Ucapan Anda menunggu persetujuan pengundang." : "Konfirmasi kehadiran Anda telah terkirim.");
      setSubmission(saved);
      setDraft(draftFromSubmission(saved));
      setEditing(false);
      setBusy("");
      requestAnimationFrame(() => savedHeadingRef.current?.focus({ preventScroll: true }));
      return;
    }
    // This explicit submit is the only write path. No API or real RSVP model is used.
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(saved));
      setStorageAvailable(true);
      setStorageWarning("");
      setPersisted(true);
      setHasStoredReply(true);
      setNotice(submission ? "Perubahan jawaban percobaan tersimpan di tab ini." : "Jawaban percobaan tersimpan di tab ini.");
    } catch {
      setStorageAvailable(false);
      setPersisted(false);
      setStorageWarning(hasStoredReply ? "Perubahan belum tersimpan di tab ini. Jawaban baru hanya tampil sementara; jawaban sebelumnya mungkin muncul kembali setelah halaman dimuat ulang." : "Penyimpanan tab tidak tersedia. Jawaban ini hanya tampil sementara dan hilang saat halaman dimuat ulang.");
      setNotice("Jawaban percobaan hanya ditampilkan sementara pada halaman ini.");
    }
    setSubmission(saved);
    setDraft(draftFromSubmission(saved));
    setEditing(false);
    setBusy("");
    requestAnimationFrame(() => savedHeadingRef.current?.focus({ preventScroll: true }));
  }

  function editReply() {
    if (!submission || busy) return;
    setDraft(draftFromSubmission(submission));
    setEditing(true);
    setConfirmDelete(false);
    setError("");
    setFields({});
    setNotice("");
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus({ preventScroll: true }));
  }

  function cancelEditing() {
    if (!submission || busy) return;
    setDraft(draftFromSubmission(submission));
    setEditing(false);
    setError("");
    setFields({});
    requestAnimationFrame(() => savedHeadingRef.current?.focus({ preventScroll: true }));
  }

  function deleteReply() {
    if (busy) return;
    setBusy("deleting");
    setError("");
    setNotice("");
    let removedFromTab = false;
    try {
      window.sessionStorage.removeItem(storageKey);
      removedFromTab = true;
      setHasStoredReply(false);
      setStorageAvailable(true);
      setStorageWarning("");
    } catch {
      setStorageAvailable(false);
      if (hasStoredReply) {
        setError("Jawaban yang tersimpan di tab ini belum dapat dihapus. Penyimpanan browser tidak tersedia; coba lagi setelah dapat diakses.");
        setBusy("");
        return;
      }
      setStorageWarning("Penyimpanan tab belum dapat diakses. Hanya jawaban sementara pada halaman ini yang dihapus.");
    }
    setSubmission(null);
    setPersisted(false);
    setDraft(blankDraft(recipientRef.current));
    setEditing(true);
    setConfirmDelete(false);
    setFields({});
    setNotice(removedFromTab ? "Jawaban percobaan di tab ini telah dihapus." : "Jawaban sementara pada halaman ini telah dihapus.");
    setBusy("");
    requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('input[name="name"]')?.focus({ preventScroll: true }));
  }

  const updatedLabel = submission ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(submission.updatedAt)) : "";

  return (
    <section id="konfirmasi" className="rsvp-section content-section" data-demo-rsvp={isTestableSample ? "live" : "local-only"} aria-labelledby={`${id}-heading`}>
      <div className="rsvp-intro">
        <p className="eyebrow">KONFIRMASI KEHADIRAN</p>
        <h2 id={`${id}-heading`} className="section-heading">Sebuah kabar,<br /><em>berarti bagi kami.</em></h2>
        <p className="rsvp-lead">Isi konfirmasi kehadiran dan titipkan ucapan hangat untuk hari istimewa kami.</p>
        <div className="rsvp-demo-note">
          <span className="rsvp-note-label">{isTestableSample ? "ANDA SEDANG MENCOBA UNDANGAN" : "ANDA SEDANG MENCOBA DEMO"}</span>
          {isTestableSample
            ? <><p>Konfirmasi kehadiran dikirim ke pemilik undangan. Ucapan akan tampil setelah disetujui.</p><p>Data ini masuk ke undangan tester untuk pengujian.</p></>
            : <><p>{storageAvailable ? "Jawaban percobaan disimpan hanya di tab browser ini. Konfirmasi dan ucapan tidak dikirim kepada mempelai." : "Penyimpanan tab tidak tersedia. Jawaban hanya tampil sementara pada halaman ini. Konfirmasi dan ucapan tidak dikirim kepada mempelai."}</p><p>Anda dapat melihat kembali, mengubah, atau menghapus jawaban selama tab ini tetap terbuka.</p></>}
        </div>
      </div>

      <div className="rsvp-card" aria-busy={loading || busy !== ""}>
        {loading ? (
          <div className="rsvp-loading" role="status">
            <span className="spinner" aria-hidden="true" />
            <p>Memuat jawaban percobaan…</p>
          </div>
        ) : loadError ? (
          <div className="rsvp-load-error">
            <p className="rsvp-note-label">KONFIRMASI KEHADIRAN</p>
            <h3>Jawaban belum dapat dimuat.</h3>
            <p className="form-error" role="alert">{loadError}</p>
            <div className="rsvp-actions"><button className="button secondary" type="button" onClick={loadReply}>Coba lagi</button><button className="text-link" type="button" onClick={startNewReply}>Isi jawaban baru</button></div>
          </div>
        ) : (
          <>
            <div className="rsvp-feedback" role="status" aria-live="polite" aria-atomic="true">
              {notice && <p className="form-notice"><CheckMark />{notice}</p>}
            </div>
            {error && <p className="form-error rsvp-main-error" role="alert">{error}</p>}
            {storageWarning && <p className="rsvp-storage-warning" role="status">{storageWarning}</p>}

            {submission && !editing ? (
              <div className="rsvp-saved">
                <div className="rsvp-saved-mark"><CheckMark /></div>
                <p className="rsvp-note-label">{isTestableSample ? "KONFIRMASI ANDA" : "KONFIRMASI DEMO ANDA"}</p>
                <h3 ref={savedHeadingRef} tabIndex={-1}>{isTestableSample ? "Jawaban Anda telah terkirim." : persisted ? "Jawaban Anda tersimpan." : "Jawaban sementara Anda."}</h3>
                <p className="rsvp-saved-time">{isTestableSample ? "Dikirim" : persisted ? "Diperbarui" : "Dicoba"} {updatedLabel} WIB</p>
                <dl className="rsvp-summary">
                  <div><dt>Nama</dt><dd>{submission.name}</dd></div>
                  <div><dt>Kehadiran</dt><dd>{attendanceLabels[submission.attendance]}</dd></div>
                  {submission.attendance === "yes" && <div><dt>Jumlah tamu</dt><dd>{submission.guests} orang</dd></div>}
                </dl>
                {submission.message && <div className="rsvp-saved-message"><span>Ucapan Anda</span><p>{submission.message}</p></div>}
                {submission.includesChildData && <p className="rsvp-saved-consent">{isTestableSample ? "Persetujuan orang tua/wali tercatat." : "Simulasi persetujuan orang tua/wali: dicentang."}</p>}
                {isTestableSample ? (
                  <div className="rsvp-actions"><button className="button secondary" type="button" onClick={startNewReply}>Kirim jawaban lain</button></div>
                ) : confirmDelete ? (
                  <fieldset className="rsvp-delete-confirm" aria-label="Konfirmasi hapus jawaban">
                    <p>Hapus jawaban percobaan untuk template ini?</p>
                    <div className="rsvp-actions">
                      <button className="button secondary" type="button" onClick={() => void deleteReply()} disabled={busy !== ""}>
                        {busy === "deleting" ? <><span className="spinner" aria-hidden="true" />Menghapus…</> : "Ya, hapus"}
                      </button>
                      <button className="text-link" type="button" onClick={() => setConfirmDelete(false)} disabled={busy !== ""}>Batal</button>
                    </div>
                  </fieldset>
                ) : (
                  <div className="rsvp-actions">
                    <button className="button secondary" type="button" onClick={editReply}>Ubah jawaban</button>
                    <button className="text-link rsvp-delete-button" type="button" onClick={() => { setConfirmDelete(true); setError(""); setNotice(""); }}>Hapus jawaban</button>
                  </div>
                )}
              </div>
            ) : (
              <form className="rsvp-form" ref={formRef} onSubmit={(event) => void handleSubmit(event)} noValidate>
                <div className="rsvp-form-heading"><span className="rsvp-note-label">SEBUAH KABAR DARI ANDA</span><h3>{submission ? "Perbarui jawaban Anda." : "Berkenan hadir?"}</h3></div>

                <div className="rsvp-field">
                  <label htmlFor={`${id}-name`}>Nama Anda <span aria-hidden="true">*</span></label>
                  <input id={`${id}-name`} name="name" type="text" autoComplete="name" placeholder="Nama lengkap Anda" value={draft.name} onChange={(event) => changeField("name", event.target.value)} required maxLength={100} readOnly={Boolean(isTestableSample && guestToken)} disabled={busy !== ""} aria-invalid={!!fields.name} aria-describedby={fields.name ? `${id}-name-error` : undefined} />
                  {fields.name && <span id={`${id}-name-error`} className="form-error">{fields.name}</span>}
                </div>

                <fieldset className="rsvp-attendance" disabled={busy !== ""} aria-describedby={fields.attendance ? `${id}-attendance-error` : undefined}>
                  <legend>Konfirmasi kehadiran <span aria-hidden="true">*</span></legend>
                  <div className="rsvp-choices">
                    {(["yes", "no", "maybe"] as const).map((value) => <label key={value} className={`rsvp-choice${draft.attendance === value ? " rsvp-choice-selected" : ""}`}><input type="radio" name="attendance" value={value} checked={draft.attendance === value} onChange={() => changeField("attendance", value)} required aria-invalid={!!fields.attendance} /><span>{attendanceLabels[value]}</span></label>)}
                  </div>
                  {fields.attendance && <span id={`${id}-attendance-error`} className="form-error">{fields.attendance}</span>}
                </fieldset>

                {draft.attendance === "yes" && <div className="rsvp-field rsvp-guests"><label htmlFor={`${id}-guests`}>Jumlah tamu <span className="rsvp-field-note">termasuk Anda</span></label><select id={`${id}-guests`} name="guests" value={draft.guests} onChange={(event) => changeField("guests", Number(event.target.value))} disabled={busy !== ""} aria-invalid={!!fields.guests} aria-describedby={fields.guests ? `${id}-guests-error` : undefined}>{[1, 2, 3, 4, 5].map((number) => <option key={number} value={number}>{number} orang</option>)}</select>{fields.guests && <span id={`${id}-guests-error`} className="form-error">{fields.guests}</span>}</div>}

                <div className="rsvp-field">
                  <label htmlFor={`${id}-message`}>Ucapan & doa <span className="rsvp-field-note">opsional</span></label>
                  <textarea id={`${id}-message`} name="message" placeholder="Tuliskan ucapan hangat Anda…" rows={4} maxLength={1000} value={draft.message} onChange={(event) => changeField("message", event.target.value)} disabled={busy !== ""} aria-invalid={!!fields.message} aria-describedby={`${id}-message-hint${fields.message ? ` ${id}-message-error` : ""}`} />
                  <span id={`${id}-message-hint`} className="rsvp-character-count">{characterCount(draft.message)} / 500 karakter</span>
                  {fields.message && <span id={`${id}-message-error`} className="form-error">{fields.message}</span>}
                </div>

                <div className="rsvp-consent-group">
                  <label className="rsvp-consent-row"><input type="checkbox" name="includesChildData" checked={draft.includesChildData} onChange={(event) => changeChildData(event.target.checked)} disabled={busy !== ""} /><span>Konfirmasi kehadiran ini mencantumkan nama atau informasi anak.</span></label>
                  {draft.includesChildData && <><label className="rsvp-consent-row rsvp-consent-row-nested"><input type="checkbox" name="guardianConsent" checked={draft.guardianConsent} onChange={(event) => changeField("guardianConsent", event.target.checked)} required disabled={busy !== ""} aria-invalid={!!fields.guardianConsent} aria-describedby={fields.guardianConsent ? `${id}-guardian-error` : `${id}-guardian-note`} /><span>{RSVP_CHILD_DATA_GUARDIAN_CONSENT_COPY}</span></label><p id={`${id}-guardian-note`} className="rsvp-consent-demo-note">Persetujuan ini hanya disimulasikan di demo. Tidak ada data yang dikirim kepada mempelai.</p>{fields.guardianConsent && <span id={`${id}-guardian-error`} className="form-error">{fields.guardianConsent}</span>}</>}
                  {isTestableSample && draft.message.trim() && <><label className="rsvp-consent-row"><input type="checkbox" name="guestbookIncludesChildData" checked={guestbookIncludesChildData} onChange={(event) => changeGuestbookChildData(event.target.checked)} disabled={busy !== ""} /><span>Ucapan ini mencantumkan nama atau informasi anak.</span></label>{guestbookIncludesChildData && <><label className="rsvp-consent-row rsvp-consent-row-nested"><input type="checkbox" name="guestbookGuardianConsent" checked={guestbookGuardianConsent} onChange={(event) => { setGuestbookGuardianConsent(event.target.checked); setFields((previous) => ({ ...previous, guestbookGuardianConsent: "" })); }} required disabled={busy !== ""} aria-invalid={!!fields.guestbookGuardianConsent} /><span>{GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_COPY}</span></label>{fields.guestbookGuardianConsent && <span className="form-error">{fields.guestbookGuardianConsent}</span>}</>}</>}
                </div>

                <div className="rsvp-honeypot" aria-hidden="true"><label htmlFor={`${id}-website`}>Website<input id={`${id}-website`} type="text" name="website" autoComplete="off" tabIndex={-1} value={draft.website} onChange={(event) => changeField("website", event.target.value)} /></label></div>

                <div className="rsvp-submit-actions">
                  <button className="button primary rsvp-submit" type="submit" disabled={busy !== ""}>{busy === "saving" ? <><span className="spinner" aria-hidden="true" />{isTestableSample ? "Mengirim…" : "Menyimpan…"}</> : isTestableSample ? "Kirim konfirmasi" : storageAvailable ? submission ? "Simpan perubahan di tab ini" : "Simpan jawaban di tab ini" : "Coba jawaban sementara"}<span aria-hidden="true">↗</span></button>
                  {submission && <button className="text-link" type="button" onClick={cancelEditing} disabled={busy !== ""}>Batal mengubah</button>}
                </div>
                <p className="rsvp-form-footnote">{isTestableSample ? "Konfirmasi kehadiran dikirim kepada pemilik undangan. Ucapan akan menunggu persetujuan." : storageAvailable ? "Dengan menekan simpan, Anda memilih menyimpan jawaban percobaan hanya di tab ini." : "Jawaban sementara akan hilang ketika halaman dimuat ulang."}</p>
              </form>
            )}
          </>
        )}
      </div>
    </section>
  );
}
