"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Ban, Copy, FileUp, MessageCircle, RefreshCw, Send, Users } from "lucide-react";
import { normalizeWhatsAppPhone, whatsappShareUrl } from "@/lib/whatsapp-link";

type GuestRsvp = { attendance: "ATTENDING" | "DECLINED" | "MAYBE"; attendeeCount: number; respondedAt: string };
type GuestRecipient = { id: string; name: string; whatsapp: string | null; linkRevokedAt: string | null; rsvp: GuestRsvp | null };
type GuestShare = { id: string; name: string; url: string; whatsappUrl?: string };
type RecipientInput = { name: string; whatsapp: string };

function invitationMessage(name: string, eventTitle: string, url: string) {
  const event = eventTitle.trim() ? ` untuk acara ${eventTitle.trim()}` : "";
  return `Halo ${name}, kami ingin mengundang Anda${event}. Silakan buka undangan berikut: ${url}`;
}

function parseRecipientCsv(text: string): RecipientInput[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(field.trim()); field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; field = "";
    } else field += char;
  }
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  if (!rows.length) return [];

  const nameIndex = rows[0].findIndex((value) => /^(name|nama|guest|tamu)(\s|_|$)/i.test(value));
  const phoneIndex = rows[0].findIndex((value) => /^(whatsapp|wa|phone|telepon|hp|no\.?\s?wa|nomor.?\s?(whatsapp|wa))/i.test(value));
  const hasHeader = nameIndex >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const dataNameIndex = hasHeader ? nameIndex : 0;
  const dataPhoneIndex = phoneIndex >= 0 ? phoneIndex : hasHeader ? -1 : 1;
  return dataRows.map((values) => ({
    name: values[dataNameIndex]?.trim() ?? "",
    whatsapp: dataPhoneIndex >= 0 ? values[dataPhoneIndex]?.trim() ?? "" : "",
  })).filter((recipient) => recipient.name);
}

function makeShare(id: string, name: string, token: string, slug: string, whatsapp: string | null, eventTitle: string): GuestShare {
  const url = `${window.location.origin}/${encodeURIComponent(slug)}?g=${encodeURIComponent(token)}`;
  return {
    id,
    name,
    url,
    ...(whatsapp ? { whatsappUrl: whatsappShareUrl(whatsapp, invitationMessage(name, eventTitle, url)) } : {}),
  };
}

function rsvpLabel(rsvp: GuestRsvp | null) {
  if (!rsvp) return "Belum mengirim konfirmasi kehadiran";
  if (rsvp.attendance === "ATTENDING") return `Hadir · ${rsvp.attendeeCount} orang`;
  if (rsvp.attendance === "DECLINED") return "Berhalangan hadir";
  return "Belum memutuskan";
}

export function GuestRecipientEditor({ invitationId, slug, eventTitle, isPublished }: { invitationId: string; slug: string; eventTitle: string; isPublished: boolean }) {
  const [guests, setGuests] = useState<GuestRecipient[]>([]);
  const [recipientsText, setRecipientsText] = useState("");
  const [phoneDrafts, setPhoneDrafts] = useState<Record<string, string>>({});
  const [shares, setShares] = useState<Record<string, GuestShare>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyGuestId, setBusyGuestId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    let active = true;
    void fetch(`/api/invitations/${encodeURIComponent(invitationId)}/guests`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => null) as { guests?: GuestRecipient[]; error?: string } | null;
        if (!response.ok) throw new Error(result?.error ?? "Daftar tamu belum dapat dimuat.");
        if (active) {
          const items = result?.guests ?? [];
          setGuests(items);
          setPhoneDrafts(Object.fromEntries(items.map((guest) => [guest.id, guest.whatsapp ?? ""])));
        }
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Daftar tamu belum dapat dimuat."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [invitationId]);

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (file.size > 1_000_000) { setError("File CSV maksimal 1 MB."); return; }
    const imported = parseRecipientCsv(await file.text());
    if (!imported.length) { setError("Tidak ada nama pada file CSV. Gunakan kolom Nama atau Name."); return; }
    if (imported.length > 100) { setError("Impor maksimal 100 tamu sekali proses. Bagi file menjadi beberapa bagian."); return; }
    const lines = imported.map(({ name, whatsapp }) => `${name}${whatsapp ? ` | ${whatsapp}` : ""}`);
    setRecipientsText((current) => [current.trim(), lines.join("\n")].filter(Boolean).join("\n"));
    setError("");
    setNotice(`${imported.length} nama dibaca dari CSV. Periksa daftar sebelum disimpan.`);
  }

  async function submitRecipients(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rows = recipientsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!rows.length) { setError("Tambahkan setidaknya satu nama tamu."); return; }
    const recipients = rows.map((line) => {
      const separator = line.lastIndexOf("|");
      return separator < 0 ? { name: line, whatsapp: "" } : { name: line.slice(0, separator).trim(), whatsapp: line.slice(separator + 1).trim() };
    });
    if (recipients.some((guest) => guest.name.length < 2 || guest.name.length > 100 || (guest.whatsapp && !normalizeWhatsAppPhone(guest.whatsapp)))) {
      setError("Periksa nama dan nomor WhatsApp. Format baris: Nama lengkap | nomor WhatsApp (opsional).");
      return;
    }
    if (recipients.length > 100) { setError("Simpan maksimal 100 tamu sekali proses."); return; }

    setBusy(true); setError(""); setNotice(""); setShares({});
    const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/guests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guests: recipients }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { guests?: Array<{ id: string; name: string; token: string; whatsapp: string | null }>; slug?: string; error?: string } | null;
    setBusy(false);
    if (!response?.ok || !result?.guests || !result.slug) { setError(result?.error ?? "Daftar tamu belum tersimpan."); return; }

    const created = result.guests.map((guest) => ({ id: guest.id, name: guest.name, whatsapp: guest.whatsapp, linkRevokedAt: null, rsvp: null }));
    setGuests((current) => [...created, ...current]);
    setPhoneDrafts((current) => ({ ...current, ...Object.fromEntries(created.map((guest) => [guest.id, guest.whatsapp ?? ""])) }));
    if (isPublished) {
      setShares(Object.fromEntries(result.guests.map((guest) => [guest.id, makeShare(guest.id, guest.name, guest.token, result.slug as string, guest.whatsapp, eventTitle)])));
    }
    setRecipientsText("");
    setNotice(`${created.length} tamu tersimpan. ${isPublished ? "Tautan pribadi siap disalin atau dikirim melalui WhatsApp." : "Setelah undangan diterbitkan, tautan pribadi dapat disiapkan."}`);
  }

  async function saveWhatsApp(guest: GuestRecipient) {
    const whatsapp = normalizeWhatsAppPhone(phoneDrafts[guest.id] ?? "");
    if (!whatsapp) { setError(`Masukkan nomor atau tautan WhatsApp yang valid untuk ${guest.name}.`); return; }
    setBusyGuestId(guest.id); setError(""); setNotice("");
    const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/guests/${encodeURIComponent(guest.id)}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "saveContact", whatsapp }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { whatsapp?: string; error?: string } | null;
    setBusyGuestId("");
    if (!response?.ok || !result?.whatsapp) { setError(result?.error ?? "Kontak WhatsApp belum tersimpan."); return; }
    setGuests((current) => current.map((item) => item.id === guest.id ? { ...item, whatsapp: result.whatsapp ?? null } : item));
    setPhoneDrafts((current) => ({ ...current, [guest.id]: result.whatsapp ?? "" }));
    setShares((current) => { const next = { ...current }; delete next[guest.id]; return next; });
    setNotice(`Kontak WhatsApp untuk ${guest.name} tersimpan dengan enkripsi.`);
  }

  async function prepareLink(guest: GuestRecipient) {
    if (!isPublished) { setError("Terbitkan undangan terlebih dahulu sebelum menyiapkan tautan untuk dikirim."); return; }
    const whatsapp = normalizeWhatsAppPhone(phoneDrafts[guest.id] ?? guest.whatsapp ?? "");
    if ((phoneDrafts[guest.id] ?? guest.whatsapp ?? "").trim() && !whatsapp) { setError(`Periksa nomor WhatsApp untuk ${guest.name}.`); return; }
    if (whatsapp !== guest.whatsapp) { setError(`Simpan perubahan nomor WhatsApp untuk ${guest.name} terlebih dahulu.`); return; }
    if (!guest.linkRevokedAt && !window.confirm(`Membuat tautan baru akan menonaktifkan tautan lama untuk ${guest.name}. Lanjutkan?`)) return;

    setBusyGuestId(guest.id); setError(""); setNotice("");
    const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/guests/${encodeURIComponent(guest.id)}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "rotate" }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { token?: string; error?: string } | null;
    setBusyGuestId("");
    if (!response?.ok || !result?.token) { setError(result?.error ?? "Tautan pribadi belum dapat dibuat."); return; }
    setShares((current) => ({ ...current, [guest.id]: makeShare(guest.id, guest.name, result.token as string, slug, whatsapp, eventTitle) }));
    setGuests((current) => current.map((item) => item.id === guest.id ? { ...item, linkRevokedAt: null, whatsapp } : item));
    setNotice(`Tautan pribadi baru untuk ${guest.name} siap. Tautan sebelumnya sudah tidak berlaku.`);
  }

  async function revokeLink(guest: GuestRecipient) {
    if (!window.confirm(`Cabut tautan pribadi untuk ${guest.name}? Tautan yang sudah dibagikan langsung tidak berlaku.`)) return;
    setBusyGuestId(guest.id); setError(""); setNotice("");
    const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/guests/${encodeURIComponent(guest.id)}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "revoke" }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusyGuestId("");
    if (!response?.ok) { setError(result?.error ?? "Tautan pribadi belum dapat dicabut."); return; }
    setGuests((current) => current.map((item) => item.id === guest.id ? { ...item, linkRevokedAt: new Date().toISOString() } : item));
    setShares((current) => { const next = { ...current }; delete next[guest.id]; return next; });
    setNotice(`Tautan untuk ${guest.name} sudah dicabut. Nama dan jawaban kehadiran tetap tersimpan.`);
  }

  async function copyUrl(share: GuestShare) {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopiedId(share.id);
      window.setTimeout(() => setCopiedId(""), 1600);
    } catch {
      setError("Tautan belum tersalin. Salin tautan dari alamat yang tampil.");
    }
  }

  return <section className="editor-recipient-panel" aria-labelledby="editor-recipient-title">
    <div className="editor-recipient-heading"><span className="editor-recipient-icon"><Users size={17} /></span><div><span className="eyebrow">DAFTAR TAMU & TAUTAN PRIBADI</span><h3 id="editor-recipient-title">Kelola tamu undangan</h3><p>Tambahkan nama dan nomor WhatsApp untuk membuat tautan undangan pribadi.</p></div></div>
    <form className="editor-recipient-form" onSubmit={(event) => void submitRecipients(event)}>
      <label className="editor-field"><span className="field-label">Nama tamu dan WhatsApp · satu baris per orang</span><textarea className="text-input text-area" rows={4} value={recipientsText} onChange={(event) => setRecipientsText(event.target.value)} placeholder={"Ryan Pratama | 62816538034\nDwi Wulan Maulida"} /><small>Format: Nama lengkap | nomor WhatsApp. Nomor bersifat opsional, disimpan terenkripsi, dan hanya terlihat bagi pengelola undangan.</small></label>
      <div className="editor-recipient-form-actions"><label className="button button--outline button--small"><FileUp size={14} /> Impor CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label><button type="submit" className="button button--dark button--small" disabled={busy || loading}>{busy ? "Menyimpan tamu…" : "Simpan nama tamu"} <Send size={14} /></button></div>
    </form>
    {!isPublished && <p className="guest-manager-notice">Terbitkan undangan terlebih dahulu untuk menyiapkan tautan yang bisa dibagikan.</p>}
    {error && <div className="editor-error" role="alert">{error}</div>}
    {notice && <p className="guest-manager-notice" role="status">{notice}</p>}
    <div className="editor-recipient-list"><div className="editor-recipient-list-heading"><b>Daftar tamu</b><span>{loading ? "Memuat…" : `${guests.length} nama tersimpan`}</span></div>{!loading && guests.length === 0 && <p className="gallery-editor-empty">Belum ada nama tamu untuk undangan ini.</p>}{guests.map((guest) => <div className="editor-recipient-row" key={guest.id}><div className="editor-recipient-identity"><b>{guest.name}</b><small>{rsvpLabel(guest.rsvp)} · {guest.linkRevokedAt ? "Tautan dicabut" : isPublished ? "Tautan aktif" : "Menunggu undangan diterbitkan"}</small></div><label className="editor-recipient-phone"><span className="sr-only">Nomor WhatsApp {guest.name}</span><input className="text-input" value={phoneDrafts[guest.id] ?? ""} onChange={(event) => setPhoneDrafts((current) => ({ ...current, [guest.id]: event.target.value }))} placeholder="Nomor WhatsApp / wa.me" /></label><div className="editor-recipient-row-actions"><button type="button" className="button button--outline button--small" disabled={busyGuestId === guest.id} onClick={() => void saveWhatsApp(guest)}>{busyGuestId === guest.id ? "Menyimpan…" : "Simpan WA"}</button>{shares[guest.id] ? <>{shares[guest.id].whatsappUrl && <a className="button button--dark button--small" href={shares[guest.id].whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} /> Kirim</a>}<button type="button" className="button button--outline button--small" onClick={() => void copyUrl(shares[guest.id])}><Copy size={13} /> Salin tautan</button></> : <button type="button" className="button button--outline button--small" disabled={busyGuestId === guest.id || loading || !isPublished} onClick={() => void prepareLink(guest)}>{busyGuestId === guest.id ? "Menyiapkan…" : "Siapkan tautan"}</button>}{!guest.linkRevokedAt && <button type="button" className="button button--outline button--small" disabled={busyGuestId === guest.id} onClick={() => void revokeLink(guest)} aria-label={`Cabut tautan untuk ${guest.name}`}><Ban size={13} /> Cabut tautan</button>}{guest.linkRevokedAt && <span className="guest-link-state guest-link-state--revoked"><RefreshCw size={12} /> Tautan dicabut</span>}</div></div>)}</div>
  </section>;
}
