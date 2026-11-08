"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, CameraOff, Check, CheckCircle2, ImagePlus, Loader2, Users, RotateCcw, SwitchCamera, Upload, X } from "lucide-react";
import { usePaparazziCamera } from "@/components/use-paparazzi-camera";
import { PaparazziPublicGallery } from "@/components/paparazzi-public-gallery";
import { PublicInvitationReport } from "@/components/public-invitation-report";
import { PAPARAZZI_CONSENT_COPY, PAPARAZZI_GUARDIAN_COPY, PAPARAZZI_STORY_HEIGHT, PAPARAZZI_STORY_WIDTH, paparazziInstagramHandleSchema, type PaparazziPublicAlbum } from "@/lib/paparazzi";

type Ticket = { photoId: string; receipt: string; uploadUrl: string; uploadHeaders?: Record<string, string>; uploadExpiresAt: number; uploaded: boolean; completed: boolean };
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function PaparazziGuest({ token, initial }: { token: string; initial: PaparazziPublicAlbum }) {
  const camera = usePaparazziCamera();
  const galleryInput = useRef<HTMLInputElement>(null); const nativeInput = useRef<HTMLInputElement>(null);
  const uploadDialog = useRef<HTMLDialogElement>(null);
  const ticketRef = useRef<Ticket | null>(null); const abortRef = useRef<AbortController | null>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState("");
  const [instagramHandle, setInstagramHandle] = useState(""); const [uploadOpen, setUploadOpen] = useState(false);
  const [consent, setConsent] = useState(false); const [child, setChild] = useState(false); const [guardian, setGuardian] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "sent">("idle");
  const [error, setError] = useState(""); const [front, setFront] = useState(false);
  const busy = phase === "uploading" || phase === "processing";
  const cameraFullScreen = camera.active || camera.opening;
  const parsedInstagramHandle = paparazziInstagramHandleSchema.safeParse(instagramHandle);

  useEffect(() => {
    const dialog = uploadDialog.current;
    if (!dialog) return;
    if (uploadOpen && !dialog.open) dialog.showModal();
    else if (!uploadOpen && dialog.open) dialog.close();
  }, [uploadOpen]);

  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url); previewHeading.current?.focus();
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => { if (preview) previewHeading.current?.focus(); }, [preview]);
  useEffect(() => () => abortRef.current?.abort(), []);

  function chooseFile(next?: File | null) {
    if (!next) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(next.type) || next.size < 1 || next.size > initial.maxBytes) { setError("Pilih JPG, PNG, atau WebP maksimal 10 MB. Untuk format lain, gunakan tombol Buka kamera."); return; }
    camera.stop(); setFile(next); ticketRef.current = null; setPhase("idle"); setConsent(false); setChild(false); setGuardian(false);
  }
  function select(event: ChangeEvent<HTMLInputElement>) { chooseFile(event.target.files?.[0]); event.target.value = ""; }
  function reset() { camera.stop(); setFile(null); ticketRef.current = null; setPhase("idle"); setConsent(false); setChild(false); setGuardian(false); setError(""); setInstagramHandle(""); }
  function dismissUpload() {
    if (busy) return;
    reset(); setUploadOpen(false);
  }

  async function send(event: FormEvent) {
    event.preventDefault(); if (!file || !parsedInstagramHandle.success || !consent || (child && !guardian) || busy) return;
    setError(""); setPhase("uploading");
    const controller = new AbortController(); abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      if (ticketRef.current && !ticketRef.current.uploaded && ticketRef.current.uploadExpiresAt <= Date.now()) ticketRef.current = null;
      if (!ticketRef.current) {
        const response = await fetch(`/api/public/paparazzi/${token}/uploads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: file.type, sizeBytes: file.size, instagramHandle: parsedInstagramHandle.data, consent, includesChildData: child, guardianConsent: child && guardian }), signal: controller.signal });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unggahan belum dapat dimulai.");
        ticketRef.current = { ...result, uploadExpiresAt: Date.now() + (result.expiresIn ?? 300) * 1_000 - 10_000, uploaded: false, completed: false };
      }
      const ticket = ticketRef.current;
      if (!ticket) throw new Error("Unggahan belum siap.");
      if (!ticket.uploaded) {
        const put = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type, ...ticket.uploadHeaders }, body: file, signal: controller.signal });
        if (!put.ok) throw new Error("Foto belum berhasil diunggah. Periksa koneksi lalu coba lagi. Jika tautan kedaluwarsa, pilih ulang foto.");
        ticket.uploaded = true;
      }
      const endpoint = `/api/public/paparazzi/${token}/photos/${ticket.photoId}`;
      if (!ticket.completed) {
        const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt: ticket.receipt }), signal: controller.signal });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unggahan belum dapat dikonfirmasi.");
        ticket.completed = true;
      }
      setPhase("processing");
      for (let attempt = 0; attempt < 40; attempt++) {
        const response = await fetch(endpoint, { headers: { "x-paparazzi-receipt": ticket.receipt }, cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) {
          if ([410, 422].includes(response.status)) { ticketRef.current = null; setFile(null); setConsent(false); setChild(false); setGuardian(false); }
          throw new Error(result.error || "Status foto belum dapat diperiksa.");
        }
        if (result.status === "READY") { setPhase("sent"); return; }
        await pause(1_200);
      }
      throw new Error("Foto sudah diunggah dan masih diproses. Ketuk Periksa unggahan untuk melanjutkan pemeriksaan.");
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error && !(cause instanceof TypeError) && !(cause instanceof SyntaxError) ? cause.message : "Foto belum berhasil dikirim. Periksa koneksi dan coba lagi.");
      else setError("Koneksi membutuhkan waktu lebih lama. Periksa koneksi dan coba lagi.");
      setPhase("idle");
    } finally { clearTimeout(timer); }
  }

  return <main className="paparazzi-guest">
    <header className="paparazzi-brand"><span className="paparazzi-brand-icon"><Camera size={19} /></span><span>tamu<span className="muted">kita</span></span><span className="paparazzi-brand-label">PAPARAZI ACARA</span></header>
    <div className="paparazzi-guest-body">
      <div className="paparazzi-intro"><p className="eyebrow">DARI SUDUT PANDANGMU</p><h1>{initial.title}</h1><p>Abadikan momen kecil yang ingin kamu bagikan.</p><span className="paparazzi-public-badge"><Users size={13} /> Foto langsung masuk galeri publik acara</span></div>
      {!initial.open && <section className="paparazzi-empty"><CameraOff size={32} /><h2>Pengumpulan foto sedang ditutup</h2><p>Pemilik acara belum membuka unggahan atau waktu unggah sudah berakhir. Minta informasi terbaru kepada pemilik acara.</p></section>}
      {initial.open && <>
        <input ref={galleryInput} aria-label="Pilih foto dari galeri" className="paparazzi-file-input" type="file" accept="image/*" onChange={select} />
        <input ref={nativeInput} aria-label="Ambil dengan kamera HP" className="paparazzi-file-input" type="file" accept="image/*" capture="environment" onChange={select} />
        <dialog ref={uploadDialog} className={`paparazzi-upload-dialog${cameraFullScreen ? " paparazzi-upload-dialog--camera" : ""}`} aria-label="Unggah foto ke galeri acara" onCancel={event => { event.preventDefault(); dismissUpload(); }} onClose={() => { setUploadOpen(false); camera.stop(); }}>
          <div className={`paparazzi-upload-dialog-content${cameraFullScreen ? " paparazzi-upload-dialog-content--camera" : ""}`}>
            <div className="paparazzi-upload-dialog-heading"><div><p className="eyebrow">KENANGAN BERSAMA</p><h2 id="paparazzi-upload-title">Bagikan foto ke galeri</h2><p>Hasil foto berformat Story vertikal {PAPARAZZI_STORY_WIDTH} × {PAPARAZZI_STORY_HEIGHT} piksel, dengan nama Instagram dan lambang WR.</p></div><button type="button" className="paparazzi-upload-dialog-close" aria-label="Tutup unggahan" onClick={dismissUpload} disabled={busy}><X size={19} /></button></div>
            <label className="paparazzi-instagram-field"><span>Nama Instagram <b>Wajib</b></span><input aria-label="Nama Instagram" type="text" value={instagramHandle} onChange={event => setInstagramHandle(event.target.value)} maxLength={31} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="@namakamu" required aria-invalid={instagramHandle.trim().length > 0 && !parsedInstagramHandle.success} aria-describedby="paparazzi-instagram-help" disabled={busy} /><small id="paparazzi-instagram-help">Username ini akan dicantumkan pada foto yang dibagikan.</small>{instagramHandle.trim().length > 0 && !parsedInstagramHandle.success && <small className="paparazzi-handle-error">Gunakan 1–30 huruf, angka, titik, atau garis bawah.</small>}</label>
        {camera.active || camera.opening ? <section className="paparazzi-camera" aria-label="Kamera acara">
          <div className="paparazzi-camera-bar"><span aria-live="polite">{camera.opening ? "Menghubungkan kamera…" : `Foto Story ${PAPARAZZI_STORY_WIDTH} × ${PAPARAZZI_STORY_HEIGHT}`}</span><button type="button" aria-label="Tutup kamera" onClick={camera.stop}><X size={21} /></button></div>
          {camera.active ? <video ref={camera.videoRef} autoPlay playsInline muted aria-label="Pratinjau kamera" onLoadedData={() => camera.setReady(true)} onClick={() => { void camera.videoRef.current?.play(); }} /> : <div className="paparazzi-camera-wait"><Loader2 className="paparazzi-spin" size={30} /><p>Izinkan penggunaan kamera pada browser.</p></div>}
          <div className="paparazzi-camera-controls"><button type="button" className="button button--outline" disabled={camera.opening} aria-label="Ganti kamera" onClick={() => { const next = !front; setFront(next); void camera.start(next ? "user" : "environment"); }}><SwitchCamera size={19} /></button><button type="button" className="paparazzi-shutter" disabled={!camera.ready} aria-label="Ambil foto" onClick={() => { void camera.capture().then(chooseFile); }}><Camera size={26} /></button><span>Ambil foto</span></div>
        </section> : phase === "sent" ? <section className="paparazzi-sent" role="status"><span><CheckCircle2 size={34} /></span><h2>Foto sudah diterima!</h2><p>Terima kasih sudah ikut mengabadikan momen. Buka galeri acara di bawah untuk melihat kenangan bersama.</p><button type="button" className="button button--dark button--wide" onClick={reset}><Camera size={17} /> Kirim foto lain</button><button type="button" className="text-link" onClick={() => { dismissUpload(); window.location.hash = "galeri-acara"; }}>Lihat galeri acara</button></section> : file && preview ? <section className="paparazzi-review">
          <div className="paparazzi-review-heading"><h2 ref={previewHeading} tabIndex={-1}>Siap dibagikan?</h2><button type="button" className="text-link" onClick={reset} disabled={busy}><RotateCcw size={14} /> Pilih ulang</button></div>
          <div className="paparazzi-photo-preview-frame">
            <Image className="paparazzi-photo-preview" src={preview} alt="Pratinjau foto sebelum dikirim" width={PAPARAZZI_STORY_WIDTH} height={PAPARAZZI_STORY_HEIGHT} unoptimized />
            {parsedInstagramHandle.success && <span className="paparazzi-watermark-preview">
              <small>{parsedInstagramHandle.data}</small>
              <Image src="/images/paparazi/wr-crest.png" alt="Watermark W&R" width={36} height={36} unoptimized />
            </span>}
          </div>
          <form onSubmit={send} className="paparazzi-consent-form">
            <label className="paparazzi-check"><input type="checkbox" checked={consent} required disabled={busy} onChange={event => setConsent(event.target.checked)} /><span>{PAPARAZZI_CONSENT_COPY}</span></label>
            <label className="paparazzi-check"><input type="checkbox" checked={child} disabled={busy} onChange={event => { setChild(event.target.checked); setGuardian(false); }} /><span>Foto ini memuat anak di bawah 18 tahun.</span></label>
            {child && <label className="paparazzi-check paparazzi-guardian"><input type="checkbox" checked={guardian} required disabled={busy} onChange={event => setGuardian(event.target.checked)} /><span>{PAPARAZZI_GUARDIAN_COPY}</span></label>}
            <button type="submit" className="button button--dark button--wide" disabled={busy || !parsedInstagramHandle.success || !consent || (child && !guardian)}>{busy ? <Loader2 size={18} className="paparazzi-spin" /> : <Upload size={18} />}{phase === "uploading" ? "Mengunggah foto…" : phase === "processing" ? "Menyiapkan foto untuk galeri…" : ticketRef.current?.uploaded ? "Periksa unggahan" : "Bagikan ke galeri acara"}</button>
            {busy && <p role="status" className="paparazzi-processing-note">Jaga halaman tetap terbuka. Foto tidak akan dikirim dua kali saat pemeriksaan diulang.</p>}
          </form>
        </section> : <section className="paparazzi-start">
          <div className="paparazzi-camera-art" aria-hidden="true"><Camera size={55} strokeWidth={1} /><span><Check size={12} /></span></div>
          <h2>Momenmu, kenangan bersama</h2><p>Ambil foto sekarang atau pilih foto yang sudah ada di HP.</p>
          <button type="button" className="button button--dark button--wide" disabled={!parsedInstagramHandle.success} onClick={() => { setError(""); setFront(false); void camera.start(); }}><Camera size={18} /> Buka kamera</button>
          <button type="button" className="button button--outline button--wide" disabled={!parsedInstagramHandle.success} onClick={() => galleryInput.current?.click()}><ImagePlus size={18} /> Pilih dari galeri</button>
          <button type="button" className="text-link paparazzi-native-link" disabled={!parsedInstagramHandle.success} onClick={() => nativeInput.current?.click()}>Gunakan kamera bawaan HP</button>
        </section>}
        {(error || camera.error) && <p className="paparazzi-error" role="alert">{error || camera.error}</p>}
        <p className="paparazzi-guest-footnote">JPG, PNG, atau WebP · Maksimal 10 MB per foto<br />Foto disimpan maksimal {initial.retentionDays} hari. Pemilik dapat mengunduhnya untuk arsip.</p>
          </div>
        </dialog>
      </>}
      <PaparazziPublicGallery token={token} available={initial.galleryAvailable} refreshKey={phase === "sent" ? ticketRef.current?.photoId ?? "sent" : "view"} onAddPhoto={initial.open ? () => { setError(""); setUploadOpen(true); } : undefined} />
      {initial.invitationSlug && <div className="paparazzi-content-report"><PublicInvitationReport slug={initial.invitationSlug} label="Laporkan konten acara" /></div>}
    </div>
    <footer className="paparazzi-footer">Momen istimewa, jadi lebih dekat. <span>TamuKita</span></footer>
  </main>;
}
