"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Copy, Download, ExternalLink, Eye, EyeOff, ImagePlus, Loader2, Pause, Play, Printer, QrCode, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import type { PaparazziOwnerAlbum } from "@/lib/paparazzi";

function localInput(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
const dateLabel = (value: string) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));

export function PaparazziOwner({ initial }: { initial: PaparazziOwnerAlbum }) {
  const [data, setData] = useState(initial); const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  const [closeInput, setCloseInput] = useState(""); const [expanded, setExpanded] = useState(false);
  const version = useRef(0);
  const loadNumber = useRef(0);
  const api = `/api/invitations/${initial.invitation.id}/paparazzi`;
  const canOpen = data.invitation.status === "PUBLISHED" && Boolean(data.invitation.expiresAt && new Date(data.invitation.expiresAt) > new Date());
  const serverClose = data.album?.closesAt;
  useEffect(() => { if (serverClose) setCloseInput(localInput(serverClose)); }, [serverClose]);

  const load = useCallback(async (cursor?: string) => {
    const current = version.current;
    const loadId = ++loadNumber.current;
    const response = await fetch(`${api}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" }).catch(() => null);
    const result = await response?.json().catch(() => null) as (PaparazziOwnerAlbum & { error?: string }) | null;
    if (current !== version.current || loadId !== loadNumber.current) return;
    if (!response?.ok || !result?.invitation) { setError(result?.error || "Album belum dapat dimuat. Coba lagi."); return; }
    setData(previous => ({ ...result, photos: cursor ? [...previous.photos, ...result.photos.filter(photo => !previous.photos.some(old => old.id === photo.id))] : result.photos }));
    setExpanded(Boolean(cursor));
  }, [api]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden && !busy && !expanded && data.album) void load(); }, 5_000);
    return () => clearInterval(timer);
  }, [busy, expanded, data.album, load]);

  async function settings(body: { enabled?: boolean; rotateQr?: true; closesAt?: string }) {
    setBusy(true); setError(""); setNotice(""); version.current++;
    const response = await fetch(api, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const result = await response?.json().catch(() => null) as (PaparazziOwnerAlbum & { error?: string }) | null;
    version.current++; setBusy(false);
    if (!response?.ok || !result?.invitation) { setError(result?.error || "Pengaturan belum dapat disimpan."); return; }
    setData(result); setExpanded(false); setNotice(body.rotateQr ? "QR baru siap. QR lama sudah tidak berlaku; unduh dan bagikan QR yang baru." : "Pengaturan Paparazi tersimpan.");
  }

  async function photoAction(photoId: string, visible?: boolean) {
    if (visible === undefined && !window.confirm("Hapus foto ini secara permanen? Foto akan hilang dari galeri dan penyimpanan acara.")) return;
    setBusy(true); setError(""); setNotice(""); version.current++;
    const response = await fetch(`${api}/photos/${photoId}`, visible === undefined ? { method: "DELETE" } : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ visible }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    version.current++; setBusy(false);
    if (!response?.ok) { setError(result?.error || "Foto belum dapat diperbarui."); return; }
    setNotice(visible === undefined ? "Foto dihapus. Penyimpanan sedang dibersihkan." : visible ? "Foto ditampilkan kembali melalui tautan keluarga." : "Foto disembunyikan dari galeri keluarga.");
    await load();
  }

  async function copyLink() {
    if (!data.album) return;
    try { await navigator.clipboard.writeText(data.album.shareUrl); setNotice("Tautan kamera dan galeri disalin."); }
    catch { setError("Salin tautan dari kolom yang tersedia."); }
  }

  return <div className="paparazzi-owner">
    {error && <p className="editor-error" role="alert">{error}</p>}{notice && <p className="auth-success paparazzi-owner-notice" role="status"><Check size={16} /> {notice}</p>}
    <div className="paparazzi-owner-layout">
      <section className="dashboard-content-card paparazzi-qr-panel">
        <div className="card-heading"><div><h2>QR keluarga</h2><p>QR khusus untuk dibagikan langsung kepada keluarga.</p></div><QrCode size={22} /></div>
        {!data.album ? <div className="paparazzi-setup"><span><QrCode size={42} /></span><h3>Abadikan momen keluarga</h3><p>Siapkan QR khusus dan bagikan kepada keluarga agar mereka dapat mengambil foto dari HP.</p><p className="paparazzi-owner-info">Foto hanya tampil melalui QR atau tautan khusus. Bagikan QR hanya kepada keluarga; siapa pun yang memegang tautan dapat membuka galeri.</p><button type="button" className="button button--dark button--wide" disabled={busy} onClick={() => void settings({ enabled: canOpen })}>{busy ? <Loader2 size={17} className="paparazzi-spin" /> : <Camera size={17} />}{canOpen ? "Siapkan QR & buka unggahan" : "Siapkan QR keluarga"}</button>{!canOpen && <small>Unggahan baru dapat dibuka setelah undangan diterbitkan dengan masa hosting aktif.</small>}</div> : <>
          <div className="paparazzi-print-sheet"><p className="eyebrow">PAPARAZI KELUARGA · TAMUKITA</p><h3>{data.invitation.title}</h3><Image src={`${api}/qr?v=${encodeURIComponent(data.album.qrVersion)}`} alt="QR kamera dan galeri keluarga" width={800} height={800} unoptimized priority /><p>Pindai QR untuk mengambil dan melihat foto keluarga.</p><small>Bagikan QR atau tautan khusus ini hanya kepada keluarga.</small></div>
          <div className="paparazzi-qr-downloads"><a className="button button--outline button--small" href={`${api}/qr?format=png&download=1`}><Download size={14} /> Unduh PNG</a><a className="button button--outline button--small" href={`${api}/qr?format=svg&download=1`}><Download size={14} /> Unduh SVG</a><button className="button button--outline button--small" type="button" onClick={() => window.print()}><Printer size={14} /> Cetak</button></div>
          <label className="editor-field"><span className="field-label">Tautan keluarga</span><input className="text-input paparazzi-share-url" value={data.album.shareUrl} readOnly onFocus={event => event.currentTarget.select()} /></label>
          <div className="paparazzi-link-actions"><button type="button" className="text-link" onClick={() => void copyLink()}><Copy size={14} /> Salin tautan</button><a className="text-link" href={data.album.shareUrl} target="_blank" rel="noreferrer">Buka halaman keluarga <ExternalLink size={14} /></a></div>
          <div className={`paparazzi-collection-status ${data.album.open ? "is-open" : ""}`}><span />{data.album.open ? "Menerima foto keluarga" : "Unggahan sedang ditutup"}</div>
          <button type="button" className="button button--dark button--wide" disabled={busy || (!data.album.open && !canOpen)} onClick={() => void settings({ enabled: !data.album?.open })}>{data.album.open ? <Pause size={16} /> : <Play size={16} />}{data.album.open ? "Tutup unggahan" : "Buka unggahan"}</button>
          {!canOpen && <p className="paparazzi-owner-info">Undangan harus terbit dan hosting aktif untuk menerima foto baru.</p>}
          <div className="paparazzi-close-setting"><label className="editor-field"><span className="field-label">Tutup otomatis (waktu perangkat)</span><input className="text-input" type="datetime-local" value={closeInput} onChange={event => setCloseInput(event.target.value)} /></label><button type="button" className="button button--outline button--small" disabled={busy || !closeInput} onClick={() => { const date = new Date(closeInput); if (!Number.isFinite(date.getTime())) { setError("Pilih waktu tutup yang valid."); return; } void settings({ closesAt: date.toISOString() }); }}>Simpan waktu</button></div>
          <p className="paparazzi-owner-info">Setelah unggahan ditutup, galeri tetap bisa dibuka melalui tautan khusus selama undangan aktif. Bagikan tautan hanya kepada keluarga. {data.album.maxPhotos === null ? "Tanpa kuota jumlah foto;" : `Batas ${data.album.maxPhotos} foto;`} foto disimpan maksimal 90 hari. Unduh foto untuk arsip.</p>
          <button type="button" className="text-link paparazzi-rotate" disabled={busy} onClick={() => { if (window.confirm("Ganti QR keluarga? QR dan tautan lama tidak akan dapat dipakai lagi. Foto yang sudah masuk tetap tersimpan.")) void settings({ rotateQr: true }); }}><RotateCcw size={14} /> Ganti QR & tautan</button>
        </>}
      </section>
      <section className="dashboard-content-card paparazzi-owner-photos">
        <div className="card-heading"><div><h2>Foto keluarga</h2><p>{data.album ? `${data.album.readyCount} foto tersimpan · ${data.album.maxPhotos === null ? "tanpa kuota jumlah foto" : `${data.album.count}/${data.album.maxPhotos} slot terpakai`}` : "Semua foto terkumpul sesuai undangan ini."}</p></div><button className="button button--outline button--small" type="button" disabled={busy} onClick={() => { setExpanded(false); void load(); }} aria-label="Muat ulang foto"><RefreshCw size={15} /></button></div>
        {data.photos.length ? <div className="paparazzi-owner-photo-grid">{data.photos.map(photo => {
          const href = `${api}/photos/${photo.id}`; const ready = photo.status === "READY";
          return <article className="paparazzi-owner-photo" key={photo.id}>{ready ? <a href={href} target="_blank" rel="noreferrer"><Image src={href} alt={`Foto keluarga ${dateLabel(photo.createdAt)}`} width={photo.width ?? 1200} height={photo.height ?? 900} unoptimized /></a> : <div className="paparazzi-photo-processing"><Loader2 size={24} className="paparazzi-spin" /><span>{photo.status === "FAILED" ? "Foto gagal diproses" : "Foto sedang diproses"}</span></div>}<div className="paparazzi-photo-meta"><span className={photo.isVisible ? "paparazzi-photo-shown" : "paparazzi-photo-hidden"}>{photo.isVisible ? <Eye size={12} /> : <EyeOff size={12} />}{photo.isVisible ? ready ? "Tampil lewat tautan" : "Akan tampil setelah diproses" : "Disembunyikan"}</span><small>{dateLabel(photo.createdAt)} WIB</small><div className="paparazzi-photo-actions">{ready && <a href={`${href}?download=1`} className="button button--outline button--small"><Download size={13} /> Unduh</a>}<button className="button button--outline button--small" type="button" disabled={busy} onClick={() => void photoAction(photo.id, !photo.isVisible)}>{photo.isVisible ? <EyeOff size={13} /> : <Eye size={13} />}{photo.isVisible ? "Sembunyikan" : "Tampilkan"}</button><button className="button button--outline button--small paparazzi-delete" type="button" aria-label="Hapus foto" disabled={busy} onClick={() => void photoAction(photo.id)}><Trash2 size={14} /></button></div></div></article>;
        })}</div> : <div className="paparazzi-gallery-empty"><ImagePlus size={30} /><h3>Menunggu momen keluarga</h3><p>Bagikan QR khusus ini kepada keluarga. Foto akan muncul di sini setelah diunggah.</p></div>}
        {data.nextCursor && <button type="button" className="button button--outline paparazzi-load-more" disabled={busy} onClick={() => void load(data.nextCursor ?? undefined)}>Muat foto sebelumnya</button>}
      </section>
    </div>
  </div>;
}
