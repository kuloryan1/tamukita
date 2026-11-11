"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, Copy, MessageCircle, Send, Users } from "lucide-react";
import { normalizeWhatsAppPhone, whatsappShareUrl } from "@/lib/whatsapp-link";

type GuestRecipient = { id: string; name: string; whatsapp: string | null; linkRevokedAt: string | null };
type GuestShare = { id: string; name: string; url: string; whatsappUrl: string };

function invitationMessage(name: string, eventTitle: string, url: string) {
  const event = eventTitle.trim() ? ` untuk acara ${eventTitle.trim()}` : "";
  return `Halo ${name}, kami ingin mengundang Anda${event}. Silakan buka undangan berikut: ${url}`;
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

  async function submitRecipients(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rows = recipientsText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!rows.length) { setError("Tambahkan nama dan WhatsApp tamu terlebih dahulu."); return; }
    const recipients = rows.map((line) => {
      const separator = line.lastIndexOf("|");
      return separator < 0 ? { name: "", whatsapp: "" } : { name: line.slice(0, separator).trim(), whatsapp: line.slice(separator + 1).trim() };
    });
    if (recipients.some((guest) => guest.name.length < 2 || guest.name.length > 100 || !normalizeWhatsAppPhone(guest.whatsapp))) {
      setError("Periksa format setiap baris: Nama lengkap | nomor WhatsApp atau tautan wa.me.");
      return;
    }
    if (recipients.length > 100) { setError("Simpan maksimal 100 tamu sekali proses."); return; }

    setBusy(true); setError(""); setNotice("");
    const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/guests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ guests: recipients }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { guests?: Array<{ id: string; name: string; token: string; whatsapp: string | null }>; error?: string } | null;
    setBusy(false);
    if (!response?.ok || !result?.guests) { setError(result?.error ?? "Daftar tamu belum tersimpan."); return; }

    const created = result.guests.map((guest) => ({
      id: guest.id,
      name: guest.name,
      whatsapp: guest.whatsapp,
      linkRevokedAt: null,
    }));
    setGuests((current) => [...created, ...current]);
    setPhoneDrafts((current) => ({ ...current, ...Object.fromEntries(created.map((guest) => [guest.id, guest.whatsapp ?? ""])) }));
    if (isPublished) {
      const newShares = result.guests.reduce<Record<string, GuestShare>>((all, guest) => {
        if (!guest.whatsapp) return all;
        const url = `${window.location.origin}/${encodeURIComponent(slug)}?g=${encodeURIComponent(guest.token)}`;
        all[guest.id] = { id: guest.id, name: guest.name, url, whatsappUrl: whatsappShareUrl(guest.whatsapp, invitationMessage(guest.name, eventTitle, url)) };
        return all;
      }, {});
      setShares((current) => ({ ...current, ...newShares }));
    }
    setRecipientsText("");
    setNotice(`${created.length} tamu tersimpan. ${isPublished ? "Tautan khusus dan tombol WhatsApp sudah siap." : "Setelah undangan diterbitkan, buat tautan WhatsApp khusus untuk setiap tamu."}`);
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
    setNotice(`Kontak WhatsApp untuk ${guest.name} tersimpan dengan enkripsi.`);
  }

  async function prepareWhatsApp(guest: GuestRecipient) {
    if (!isPublished) { setError("Terbitkan undangan terlebih dahulu sebelum menyiapkan tautan untuk dikirim."); return; }
    const whatsapp = normalizeWhatsAppPhone(phoneDrafts[guest.id] ?? guest.whatsapp ?? "");
    if (!whatsapp) { setError(`Simpan nomor WhatsApp untuk ${guest.name} terlebih dahulu.`); return; }
    if (whatsapp !== guest.whatsapp) { setError(`Simpan perubahan nomor WhatsApp untuk ${guest.name} terlebih dahulu.`); return; }
    if (!guest.linkRevokedAt && !window.confirm(`Membuat tautan baru akan menonaktifkan tautan lama untuk ${guest.name}. Lanjutkan?`)) return;

    setBusyGuestId(guest.id); setError(""); setNotice("");
    const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/guests/${encodeURIComponent(guest.id)}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "rotate" }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { token?: string; error?: string } | null;
    setBusyGuestId("");
    if (!response?.ok || !result?.token) { setError(result?.error ?? "Tautan WhatsApp belum dapat dibuat."); return; }
    const url = `${window.location.origin}/${encodeURIComponent(slug)}?g=${encodeURIComponent(result.token)}`;
    setShares((current) => ({ ...current, [guest.id]: { id: guest.id, name: guest.name, url, whatsappUrl: whatsappShareUrl(whatsapp, invitationMessage(guest.name, eventTitle, url)) } }));
    setGuests((current) => current.map((item) => item.id === guest.id ? { ...item, linkRevokedAt: null, whatsapp } : item));
    setNotice(`Tautan pribadi baru untuk ${guest.name} siap. Tautan sebelumnya sudah tidak berlaku.`);
  }

  async function copyUrl(share: GuestShare) {
    try {
      await navigator.clipboard.writeText(share.url);
      setCopiedId(share.id);
      window.setTimeout(() => setCopiedId(""), 1600);
    } catch {
      setError("Tautan belum tersalin. Kamu bisa menyalinnya dari alamat yang tampil.");
    }
  }

  return <section className="editor-recipient-panel" aria-labelledby="editor-recipient-title">
    <div className="editor-recipient-heading"><span className="editor-recipient-icon"><Users size={17} /></span><div><span className="eyebrow">TAUTAN PRIBADI TAMU</span><h3 id="editor-recipient-title">Siapkan undangan WhatsApp</h3><p>Setiap nama mendapat tautan unik. Nama tamu akan tampil di sampul saat undangan dibuka.</p></div></div>
    <form className="editor-recipient-form" onSubmit={(event) => void submitRecipients(event)}>
      <label className="editor-field"><span className="field-label">Nama tamu dan WhatsApp · satu baris per orang</span><textarea className="text-input text-area" rows={4} value={recipientsText} onChange={(event) => setRecipientsText(event.target.value)} placeholder={"Alya Putri | 628123456789\nBima Santoso | https://wa.me/628987654321"} /><small>Masukkan nomor dengan kode negara, atau tautan wa.me. Nomor tersimpan terenkripsi dan hanya terlihat bagi pengelola undangan.</small></label>
      <button type="submit" className="button button--dark button--small" disabled={busy || loading}>{busy ? "Menyimpan tamu…" : "Simpan nama & WhatsApp"} <Send size={14} /></button>
    </form>
    {error && <div className="editor-error" role="alert">{error}</div>}
    {notice && <p className="guest-manager-notice" role="status">{notice}</p>}
    {Object.values(shares).length > 0 && <div className="guest-created-links"><h2>Tautan siap dibagikan</h2><p>Tombol WhatsApp membuka pesan yang sudah berisi nama dan tautan. Pesan baru terkirim setelah kamu menekan Kirim di WhatsApp.</p>{Object.values(shares).map((share) => <div className="guest-link-row" key={share.id}><b>{share.name}</b><span title={share.url}>{share.url}</span><button type="button" className="button button--outline button--small" onClick={() => void copyUrl(share)}>{copiedId === share.id ? <Check size={13} /> : <Copy size={13} />}{copiedId === share.id ? "Tersalin" : "Salin"}</button><a className="button button--outline button--small" href={share.whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} /> WhatsApp</a></div>)}</div>}
    <div className="editor-recipient-list"><div className="editor-recipient-list-heading"><b>Daftar tamu</b><span>{loading ? "Memuat…" : `${guests.length} nama tersimpan`}</span></div>{!loading && guests.length === 0 && <p className="gallery-editor-empty">Belum ada nama tamu untuk undangan ini.</p>}{guests.map((guest) => <div className="editor-recipient-row" key={guest.id}><div className="editor-recipient-identity"><b>{guest.name}</b><small>{guest.linkRevokedAt ? "Tautan dicabut" : "Tautan pribadi tersedia"}</small></div><label className="editor-recipient-phone"><span className="sr-only">Nomor WhatsApp {guest.name}</span><input className="text-input" value={phoneDrafts[guest.id] ?? ""} onChange={(event) => setPhoneDrafts((current) => ({ ...current, [guest.id]: event.target.value }))} placeholder="Nomor WhatsApp / wa.me" /></label><button type="button" className="button button--outline button--small" disabled={busyGuestId === guest.id} onClick={() => void saveWhatsApp(guest)}>{busyGuestId === guest.id ? "Menyimpan…" : "Simpan WA"}</button>{shares[guest.id]?.whatsappUrl ? <a className="button button--dark button--small" href={shares[guest.id].whatsappUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={13} /> Kirim</a> : <button type="button" className="button button--outline button--small" disabled={busyGuestId === guest.id || loading || !isPublished} onClick={() => void prepareWhatsApp(guest)}>{busyGuestId === guest.id ? "Menyiapkan…" : "Siapkan tautan"}</button>}</div>)}</div>
  </section>;
}
