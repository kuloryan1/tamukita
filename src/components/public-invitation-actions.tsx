"use client";

import { useRef, useState, type FormEvent } from "react";
import { CheckCircle2, Copy, Flag, Heart, Music2, Pause, Play, Send, X } from "lucide-react";
import { GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_COPY, RSVP_CHILD_DATA_GUARDIAN_CONSENT_COPY } from "@/lib/consent-copy";

type GuestbookMessage = { id: string; displayName: string; message: string; createdAt: string };
type ReportReason = "SPAM" | "HARASSMENT" | "PERSONAL_INFORMATION" | "OTHER";

export function PublicInvitationMusic({ src, title }: { src: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    await audio.play().catch(() => setPlaying(false));
  };

  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: Optional background music has no speech or dialogue to caption. */}
      <audio ref={audioRef} src={src} loop preload="none" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} />
      <button type="button" className="public-music-toggle" onClick={() => void toggle()} aria-label={`${playing ? "Jeda" : "Putar"} musik latar${title ? `: ${title}` : ""}`} title={title || undefined}>
        {playing ? <Pause size={13} /> : <Play size={13} />}<Music2 size={13} /><span>{playing ? "Jeda musik" : "Putar musik"}</span>
      </button>
    </>
  );
}

export function PublicInvitationGiftCopy({ accountNumber }: { accountNumber: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setCopied(false);
    }
  };
  return <button className="button button--outline button--small" type="button" onClick={() => void copy()}>{copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}{copied ? "Tersalin" : "Salin nomor rekening"}</button>;
}

export function PublicInvitationRsvp({ slug, initialCount, recipientName, guestToken }: { slug: string; initialCount: number; recipientName?: string; guestToken?: string }) {
  const [open, setOpen] = useState(false);
  const [guestName, setGuestName] = useState(recipientName ?? "");
  const [attendance, setAttendance] = useState<"Hadir" | "Berhalangan">("Hadir");
  const [attendeeCount, setAttendeeCount] = useState(1);
  const [includesChildData, setIncludesChildData] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [rsvpCount, setRsvpCount] = useState(initialCount);
  const attendanceCopy = attendance === "Hadir"
    ? {
        eyebrow: "KABAR BAIK UNTUK KAMI",
        title: "Kamu bisa hadir?",
        submittedData: "Nama, pilihan kehadiran, dan jumlah tamu yang dikirim akan diterima",
      }
    : {
        eyebrow: "TERIMA KASIH SUDAH MEMBERI KABAR",
        title: "Kami mengerti kamu berhalangan hadir",
        submittedData: "Nama dan pilihan kehadiran yang dikirim akan diterima",
      };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!guestName.trim()) return;
    setError("");
    const response = await fetch(`/api/public/invitations/${encodeURIComponent(slug)}/rsvp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: guestName.trim(), ...(guestToken ? { guestToken } : {}), attendance: attendance === "Hadir" ? "ATTENDING" : "DECLINED", attendeeCount, includesChildData, guardianConsent }),
    }).catch(() => null);
    const result = await response?.json().catch(() => ({})) as { error?: string; created?: boolean } | undefined;
    if (!response?.ok) {
      setError(result?.error ?? "RSVP belum dapat dikirim. Periksa koneksi dan coba lagi.");
      return;
    }
    if (result?.created) setRsvpCount((count) => count + 1);
    setSubmitted(true);
  };

  return (
    <>
      <button type="button" className="button button--dark" onClick={() => { setOpen(true); setSubmitted(false); setError(""); setIncludesChildData(false); setGuardianConsent(false); }}><Heart size={15} /> Konfirmasi kehadiran</button>
      <span className="rsvp-count"><CheckCircle2 size={14} /> {rsvpCount > 0 ? `${rsvpCount} tamu telah mengirim RSVP` : "Jadilah yang pertama mengirim RSVP"}</span>
      {open && <div className="modal-backdrop" role="presentation"><section className="rsvp-modal" role="dialog" aria-modal="true" aria-labelledby="rsvp-title"><button type="button" className="modal-close" onClick={() => setOpen(false)} aria-label="Tutup"><X size={18} /></button>{submitted ? <div className="rsvp-confirmation"><span><CheckCircle2 size={28} /></span><h2>Terima kasih, {guestName}!</h2><p>Jawabanmu sudah dicatat untuk undangan ini. Terima kasih sudah memberi kabar.</p><button type="button" className="button button--dark" onClick={() => setOpen(false)}>Selesai</button></div> : <><span className="eyebrow">{attendanceCopy.eyebrow}</span><h2 id="rsvp-title">{attendanceCopy.title}</h2><p className="rsvp-modal-intro">{attendanceCopy.submittedData} oleh pemilik undangan untuk mengelola acara. Jangan masukkan kontak atau data sensitif anak. Jika RSVP mencantumkan nama atau informasi anak, orang tua/wali harus mengisi dan menyetujuinya di bawah.</p><form onSubmit={submit}>{guestToken ? <div className="editor-field"><span className="field-label">Undangan untuk</span><input className="text-input" aria-label="Undangan untuk" value={guestName} readOnly /></div> : <label className="editor-field"><span className="field-label">Nama lengkap</span><input className="text-input" required maxLength={100} value={guestName} onChange={(event) => setGuestName(event.target.value)} placeholder="Nama kamu" /></label>}<fieldset className="rsvp-options"><legend className="field-label">Pilih kehadiran</legend><button type="button" aria-pressed={attendance === "Hadir"} className={attendance === "Hadir" ? "is-selected" : ""} onClick={() => setAttendance("Hadir")}>Dengan senang hati hadir</button><button type="button" aria-pressed={attendance === "Berhalangan"} className={attendance === "Berhalangan" ? "is-selected" : ""} onClick={() => setAttendance("Berhalangan")}>Mohon maaf berhalangan</button></fieldset>{attendance === "Hadir" && <label className="editor-field"><span className="field-label">Jumlah tamu yang hadir</span><select className="text-input" value={attendeeCount} onChange={(event) => setAttendeeCount(Number(event.target.value))}>{Array.from({ length: 10 }, (_, index) => index + 1).map((count) => <option key={count} value={count}>{count} orang</option>)}</select></label>}<label className="public-consent-row"><input type="checkbox" checked={includesChildData} onChange={(event) => { setIncludesChildData(event.target.checked); setGuardianConsent(false); }} /><span>RSVP ini mencantumkan nama atau informasi anak.</span></label>{includesChildData && <label className="public-consent-row public-consent-row--nested"><input type="checkbox" required checked={guardianConsent} onChange={(event) => setGuardianConsent(event.target.checked)} /><span>{RSVP_CHILD_DATA_GUARDIAN_CONSENT_COPY}</span></label>}{error && <div className="editor-error" role="alert">{error}</div>}<button className="button button--dark button--wide" type="submit">Kirim konfirmasi <Send size={15} /></button><small className="rsvp-demo-note"><Music2 size={12} /> Pengundang akan menerima email konfirmasi bila alamat emailnya tersedia.</small></form></>}</section></div>}
    </>
  );
}

export function PublicInvitationGuestbook({ slug, entries }: { slug: string; entries: GuestbookMessage[] }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [includesChildData, setIncludesChildData] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const [reportingEntryId, setReportingEntryId] = useState("");
  const [reportedEntryIds, setReportedEntryIds] = useState<string[]>([]);
  const [reportReason, setReportReason] = useState<ReportReason>("OTHER");
  const [reportError, setReportError] = useState("");
  const [reportBusyId, setReportBusyId] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSending(true);
    const response = await fetch(`/api/public/invitations/${encodeURIComponent(slug)}/guestbook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: name.trim(), message: message.trim(), includesChildData, guardianConsent }),
    }).catch(() => null);
    const result = await response?.json().catch(() => ({})) as { error?: string } | undefined;
    setSending(false);
    if (!response?.ok) {
      setError(result?.error ?? "Ucapan belum dapat dikirim. Periksa koneksi dan coba lagi.");
      return;
    }
    setName("");
    setMessage("");
    setIncludesChildData(false);
    setGuardianConsent(false);
    setSent(true);
  };

  const report = async (entryId: string) => {
    setReportBusyId(entryId);
    setReportError("");
    const response = await fetch(`/api/public/invitations/${encodeURIComponent(slug)}/guestbook/${encodeURIComponent(entryId)}/reports`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: reportReason }),
    }).catch(() => null);
    const result = await response?.json().catch(() => ({})) as { error?: string } | undefined;
    setReportBusyId("");
    if (!response?.ok) {
      setReportError(result?.error ?? "Laporan belum dapat dikirim. Coba lagi.");
      return;
    }
    setReportedEntryIds((current) => current.includes(entryId) ? current : [...current, entryId]);
    setReportingEntryId("");
  };

  return (
    <section className="public-guestbook-section">
      <div className="guestbook-inner">
        <div className="guestbook-heading"><span className="eyebrow">UCAPAN & DOA</span><h2>Kirimkan <em>doa terbaikmu.</em></h2><p>Nama dan ucapan yang kamu kirim diterima oleh pemilik undangan untuk ditinjau; ucapan tampil pada halaman undangan setelah disetujui. Jangan masukkan kontak atau data sensitif anak. Jika ucapan mencantumkan nama atau informasi anak, orang tua/wali harus mengirim dan menyetujuinya.</p></div>
        <form className="guestbook-form" onSubmit={submit}>
          <label className="editor-field"><span className="field-label">Namamu</span><input className="text-input" required minLength={2} maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama lengkap" /></label>
          <label className="editor-field"><span className="field-label">Ucapan</span><textarea className="text-input text-area" required minLength={2} maxLength={1000} rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Tulis doa atau pesan untuk pengantin..." /></label>
          <label className="public-consent-row"><input type="checkbox" checked={includesChildData} onChange={(event) => { setIncludesChildData(event.target.checked); setGuardianConsent(false); }} /><span>Ucapan ini mencantumkan nama atau informasi anak.</span></label>
          {includesChildData && <label className="public-consent-row public-consent-row--nested"><input type="checkbox" required checked={guardianConsent} onChange={(event) => setGuardianConsent(event.target.checked)} /><span>{GUESTBOOK_CHILD_DATA_GUARDIAN_CONSENT_COPY}</span></label>}
          {error && <div className="editor-error" role="alert">{error}</div>}
          {sent && <p className="guestbook-success" role="status">Terima kasih. Ucapanmu menunggu persetujuan pengundang.</p>}
          <button className="button button--dark" type="submit" disabled={sending}>{sending ? "Mengirim..." : "Kirim ucapan"} <Send size={14} /></button>
        </form>
        <div className="guestbook-list" aria-live="polite">
          {entries.length ? entries.map((entry) => <article className="guestbook-entry" key={entry.id}>
            <span className="guestbook-heart"><Heart size={14} fill="currentColor" /></span>
            <div className="guestbook-entry-body">
              <h3>{entry.displayName}</h3><p>{entry.message}</p>
              <time dateTime={entry.createdAt}>{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(entry.createdAt))}</time>
              {reportedEntryIds.includes(entry.id) ? <span className="guestbook-report-confirmation" role="status">Laporan diterima. Terima kasih sudah membantu menjaga ruang ini.</span> : <>
                <button className="guestbook-report-trigger" type="button" aria-label="Laporkan ucapan" aria-expanded={reportingEntryId === entry.id} onClick={() => { setReportError(""); setReportingEntryId((current) => current === entry.id ? "" : entry.id); }}><Flag size={12} /> Laporkan</button>
                {reportingEntryId === entry.id && <fieldset className="guestbook-report-form">
                  <legend className="field-label">Laporkan ucapan</legend>
                  <label className="editor-field"><span className="field-label">Alasan laporan</span><select className="text-input" aria-label="Alasan laporan" value={reportReason} onChange={(event) => setReportReason(event.target.value as ReportReason)}><option value="SPAM">Spam atau promosi</option><option value="HARASSMENT">Pelecehan atau ujaran menyerang</option><option value="PERSONAL_INFORMATION">Informasi pribadi</option><option value="OTHER">Alasan lainnya</option></select></label>
                  {reportError && <div className="editor-error" role="alert">{reportError}</div>}
                  <div className="guestbook-report-actions"><button className="button button--dark button--small" type="button" disabled={reportBusyId === entry.id} onClick={() => void report(entry.id)}>{reportBusyId === entry.id ? "Mengirim..." : "Kirim laporan"}</button><button className="button button--outline button--small" type="button" disabled={reportBusyId === entry.id} onClick={() => setReportingEntryId("")}>Batal</button></div>
                </fieldset>}
              </>}
            </div>
          </article>) : <p className="guestbook-empty">Belum ada ucapan yang disetujui.</p>}
        </div>
      </div>
    </section>
  );
}
