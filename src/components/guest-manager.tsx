"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Check, Copy, FileUp, RefreshCw, Send, Users } from "lucide-react";

type Guest = { id: string; name: string; linkRevokedAt: string | null; rsvp: { attendance: "ATTENDING" | "DECLINED" | "MAYBE"; attendeeCount: number; respondedAt: string } | null };
type GuestLink = { id: string; name: string; token: string; url: string };
type RsvpResponse = { id: string; displayName: string; attendance: "ATTENDING" | "DECLINED" | "MAYBE"; attendeeCount: number; respondedAt: string };

function parseCsv(text: string) {
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
  const headerIndex = rows[0].findIndex((value) => /^(name|nama|guest|tamu)(\s|_|$)/i.test(value));
  const column = headerIndex >= 0 ? headerIndex : 0;
  const dataRows = headerIndex >= 0 ? rows.slice(1) : rows;
  return dataRows.map((values) => values[column]?.trim() ?? "").filter(Boolean);
}

export function GuestManager({ invitationId, slug, initialGuests, initialResponses }: { invitationId: string; slug: string; initialGuests: Guest[]; initialResponses: RsvpResponse[] }) {
  const [guests, setGuests] = useState(initialGuests);
  const [namesText, setNamesText] = useState("");
  const [newLinks, setNewLinks] = useState<GuestLink[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyGuestId, setBusyGuestId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copiedId, setCopiedId] = useState("");

  async function importCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = "";
    if (file.size > 1_000_000) { setError("File CSV maksimal 1 MB."); return; }
    const imported = parseCsv(await file.text());
    if (!imported.length) { setError("Tidak ada nama pada file CSV. Gunakan kolom Nama atau Name."); return; }
    if (imported.length > 100) { setError("Impor maksimal 100 tamu sekali proses. Bagi file menjadi beberapa bagian."); return; }
    setNamesText((current) => [current.trim(), imported.join("\n")].filter(Boolean).join("\n"));
    setError("");
    setNotice(`${imported.length} nama dibaca dari CSV. Periksa daftarnya sebelum disimpan.`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const names = namesText.split(/[\n;]+/).map((name) => name.trim()).filter(Boolean);
    if (!names.length) { setError("Tambahkan setidaknya satu nama tamu."); return; }
    setBusy(true); setError(""); setNotice(""); setNewLinks([]);
    const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/guests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ names }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { guests?: Array<{ id: string; name: string; token: string }>; slug?: string; error?: string } | null;
    setBusy(false);
    if (!response?.ok || !result?.guests || !result.slug) { setError(result?.error ?? "Daftar tamu belum tersimpan."); return; }
    const invitationSlug = result.slug;
    const links = result.guests.map((guest) => ({ ...guest, url: `${window.location.origin}/${encodeURIComponent(invitationSlug)}?g=${encodeURIComponent(guest.token)}` }));
    setGuests((current) => [...links.map(({ id, name }) => ({ id, name, linkRevokedAt: null, rsvp: null })), ...current]);
    setNewLinks(links);
    setNamesText("");
    setNotice(`${links.length} tamu tersimpan. Salin tautan khusus masing-masing dan kirim secara manual.`);
  }

  async function copyLink(link: GuestLink) {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
      window.setTimeout(() => setCopiedId(""), 1800);
    } catch {
      setError("Browser tidak mengizinkan salin otomatis. Salin tautan dari teks yang ditampilkan.");
    }
  }

  async function updateGuestLink(guest: Guest, action: "revoke" | "rotate") {
    if (action === "revoke" && !window.confirm(`Cabut tautan pribadi untuk ${guest.name}? Tautan yang sudah dibagikan langsung tidak berlaku. Nama dan RSVP tetap tersimpan.`)) return;
    setBusyGuestId(guest.id); setError(""); setNotice("");
    const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/guests/${encodeURIComponent(guest.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { token?: string; error?: string } | null;
    setBusyGuestId("");
    if (!response?.ok || (action === "rotate" && !result?.token)) { setError(result?.error ?? "Status tautan tamu belum diperbarui."); return; }
    if (action === "revoke") {
      setGuests((current) => current.map((item) => item.id === guest.id ? { ...item, linkRevokedAt: new Date().toISOString() } : item));
      setNewLinks((current) => current.filter((link) => link.id !== guest.id));
      setNotice(`Tautan untuk ${guest.name} sudah dicabut. Nama dan RSVP tetap tersimpan.`);
      return;
    }
    const token = result?.token as string;
    const link = { id: guest.id, name: guest.name, token, url: `${window.location.origin}/${encodeURIComponent(slug)}?g=${encodeURIComponent(token)}` };
    setGuests((current) => current.map((item) => item.id === guest.id ? { ...item, linkRevokedAt: null } : item));
    setNewLinks((current) => [link, ...current.filter((item) => item.id !== guest.id)]);
    setNotice(`Tautan baru untuk ${guest.name} dibuat. Tautan lama sudah tidak berlaku; salin tautan baru sebelum meninggalkan halaman.`);
  }

  return <div className="guest-manager">
    <Link href="/dashboard" className="back-link"><ArrowLeft size={15} /> Kembali ke dashboard</Link>
    <div className="dashboard-page-heading guest-manager-heading"><div><p className="dashboard-date">DAFTAR TAMU · tamukita.io/{slug}</p><h1><Users size={25} /> Tamu undangan</h1><p>Impor nama, lalu bagikan tautan khusus secara manual.</p></div><Link href={`/${slug}`} target="_blank" className="button button--outline">Lihat undangan</Link></div>
    <section className="guest-import-card"><div><span className="eyebrow">TAMBAHKAN TAMU</span><h2>Siapkan tautan pribadi.</h2><p>Setiap tamu mendapat token acak. Nama dan nomor telepon tidak dimasukkan ke token.</p></div><form onSubmit={submit}><label className="editor-field"><span className="field-label">Nama tamu · satu nama per baris</span><textarea className="text-input text-area" rows={6} value={namesText} onChange={(event) => setNamesText(event.target.value)} placeholder={'Alya Putri\nBima Santoso'} /></label><div className="guest-import-actions"><label className="button button--outline button--small"><FileUp size={14} /> Impor CSV<input type="file" accept=".csv,text/csv" onChange={importCsv} /></label><button type="submit" className="button button--dark button--small" disabled={busy}>{busy ? "Menyimpan..." : "Simpan & buat tautan"} <Send size={14} /></button></div>{error && <div className="editor-error" role="alert">{error}</div>}{notice && <p className="guest-manager-notice" role="status">{notice}</p>}</form></section>
    {newLinks.length > 0 && <section className="guest-created-links"><h2>Tautan baru</h2><p>Tautan ini hanya ditampilkan sekarang. Salin atau kirim sebelum meninggalkan halaman.</p>{newLinks.map((link) => <div className="guest-link-row" key={link.id}><b>{link.name}</b><span>{link.url}</span><button type="button" className="button button--outline button--small" onClick={() => void copyLink(link)}>{copiedId === link.id ? <Check size={14} /> : <Copy size={14} />}{copiedId === link.id ? "Tersalin" : "Salin"}</button><a className="button button--outline button--small" href={`https://wa.me/?text=${encodeURIComponent(`Undangan untuk ${link.name}: ${link.url}`)}`} target="_blank" rel="noreferrer">WhatsApp</a></div>)}</section>}
    <section className="dashboard-content-card guest-list-card"><div className="card-heading"><div><h2>Daftar tamu</h2><p>{guests.length} nama · RSVP akan muncul saat tamu menjawab.</p></div></div>{guests.length === 0 ? <div className="dashboard-empty-state"><h3>Daftar tamu masih kosong</h3><p>Tambahkan nama secara manual atau impor file CSV.</p></div> : guests.map((guest) => <div className="guest-list-row" key={guest.id}><div><b>{guest.name}</b><small>{guest.rsvp ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(guest.rsvp.respondedAt)) : "Belum mengirim RSVP"}</small></div><div className="guest-list-actions"><span className={`status-pill ${guest.rsvp?.attendance === "ATTENDING" ? "status-pill--live" : "status-pill--draft"}`}><i />{guest.rsvp?.attendance === "ATTENDING" ? `Hadir · ${guest.rsvp.attendeeCount}` : guest.rsvp?.attendance === "DECLINED" ? "Berhalangan" : "Menunggu RSVP"}</span><span className={`guest-link-state${guest.linkRevokedAt ? " guest-link-state--revoked" : ""}`}>{guest.linkRevokedAt ? "Tautan dicabut" : "Tautan aktif"}</span><button type="button" className="button button--outline button--small" onClick={() => void updateGuestLink(guest, guest.linkRevokedAt ? "rotate" : "revoke")} disabled={busyGuestId === guest.id} aria-label={`${guest.linkRevokedAt ? "Buat tautan baru untuk" : "Cabut tautan untuk"} ${guest.name}`}>{guest.linkRevokedAt ? <><RefreshCw size={13} /> {busyGuestId === guest.id ? "Membuat..." : "Buat tautan baru"}</> : <><Ban size={13} /> {busyGuestId === guest.id ? "Mencabut..." : "Cabut tautan"}</>}</button></div></div>)}</section>
    <section className="dashboard-content-card guest-list-card"><div className="card-heading"><div><h2>Semua konfirmasi RSVP</h2><p>{initialResponses.length} jawaban terbaru, termasuk dari tamu tanpa tautan pribadi.</p></div></div>{initialResponses.length === 0 ? <div className="dashboard-empty-state"><h3>Belum ada konfirmasi</h3><p>Jawaban RSVP akan muncul di sini setelah tamu mengirimkannya.</p></div> : initialResponses.map((response) => <div className="guest-list-row" key={response.id}><div><b>{response.displayName}</b><small>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(response.respondedAt))}</small></div><span className={`status-pill ${response.attendance === "ATTENDING" ? "status-pill--live" : "status-pill--draft"}`}><i />{response.attendance === "ATTENDING" ? `Hadir · ${response.attendeeCount}` : response.attendance === "DECLINED" ? "Berhalangan" : "Belum memutuskan"}</span></div>)}</section>
  </div>;
}
