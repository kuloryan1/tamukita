"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, CameraOff, Check, CheckCircle2, ImagePlus, Loader2, Users, RotateCcw, SwitchCamera, Trash2, Upload, X } from "lucide-react";
import { usePaparazziCamera } from "@/components/use-paparazzi-camera";
import { PaparazziPublicGallery } from "@/components/paparazzi-public-gallery";
import { PublicInvitationReport } from "@/components/public-invitation-report";
import { PAPARAZZI_GUARDIAN_COPY, PAPARAZZI_MAX_BATCH_PHOTOS, PAPARAZZI_STORY_HEIGHT, PAPARAZZI_STORY_WIDTH, paparazziInstagramHandleSchema, type PaparazziPublicAlbum } from "@/lib/paparazzi";

type Ticket = { photoId: string; receipt: string; uploadUrl: string; uploadHeaders?: Record<string, string>; uploadExpiresAt: number; uploaded: boolean; completed: boolean; ready?: boolean };
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function PaparazziGuest({ token, initial }: { token: string; initial: PaparazziPublicAlbum }) {
  const camera = usePaparazziCamera();
  const galleryInput = useRef<HTMLInputElement>(null); const nativeInput = useRef<HTMLInputElement>(null);
  const uploadDialog = useRef<HTMLDialogElement>(null);
  const ticketRef = useRef<Array<Ticket | null>>([]); const filesRef = useRef<File[]>([]); const abortRef = useRef<AbortController | null>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const [files, setFiles] = useState<File[]>([]); const [previews, setPreviews] = useState<string[]>([]);
  const [instagramHandle, setInstagramHandle] = useState(""); const [uploadOpen, setUploadOpen] = useState(false);
  const [child, setChild] = useState(false); const [guardian, setGuardian] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "sent">("idle");
  const [error, setError] = useState(""); const [front, setFront] = useState(false); const [captureBusy, setCaptureBusy] = useState(false); const [progress, setProgress] = useState(0);
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
    const urls = files.map(file => URL.createObjectURL(file));
    setPreviews(urls);
    if (urls.length) previewHeading.current?.focus();
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [files]);
  useEffect(() => () => abortRef.current?.abort(), []);

  function setSelectedFiles(next: File[]) {
    filesRef.current = next;
    setFiles(next);
  }

  function isValidPhoto(next: File) {
    return ["image/jpeg", "image/png", "image/webp"].includes(next.type) && next.size >= 1 && next.size <= initial.maxBytes;
  }

  function chooseFiles(next: File[]) {
    if (!next.length) return;
    setError("");
    if (next.length > PAPARAZZI_MAX_BATCH_PHOTOS) { setError(`Pilih maksimal ${PAPARAZZI_MAX_BATCH_PHOTOS} foto per kiriman.`); return; }
    if (next.some(file => !isValidPhoto(file))) { setError("Pilih JPG, PNG, atau WebP maksimal 10 MB per foto. Untuk format lain, gunakan tombol Buka kamera."); return; }
    camera.stop(); setSelectedFiles(next); ticketRef.current = next.map(() => null); setPhase("idle"); setProgress(0); setChild(false); setGuardian(false);
  }
  function select(event: ChangeEvent<HTMLInputElement>) { chooseFiles(Array.from(event.target.files ?? [])); event.target.value = ""; }
  function reset() { camera.stop(); setSelectedFiles([]); ticketRef.current = []; setPhase("idle"); setProgress(0); setCaptureBusy(false); setChild(false); setGuardian(false); setError(""); setInstagramHandle(""); }
  function dismissUpload() {
    if (busy || (ticketRef.current.some(Boolean) && phase !== "sent")) return;
    reset(); setUploadOpen(false);
  }

  function removePhoto(index: number) {
    if (busy || ticketRef.current[index]) return;
    const next = filesRef.current.filter((_, photoIndex) => photoIndex !== index);
    ticketRef.current = ticketRef.current.filter((_, photoIndex) => photoIndex !== index);
    setSelectedFiles(next);
  }

  function addCapturedPhoto(next: File) {
    if (!isValidPhoto(next)) { setError("Foto harus JPG, PNG, atau WebP maksimal 10 MB."); return; }
    const selected = filesRef.current;
    if (selected.length >= PAPARAZZI_MAX_BATCH_PHOTOS) { camera.stop(); return; }
    setError("");
    setSelectedFiles([...selected, next]);
    ticketRef.current = [...ticketRef.current, null];
    if (selected.length + 1 >= PAPARAZZI_MAX_BATCH_PHOTOS) camera.stop();
  }

  async function capturePhoto() {
    if (captureBusy || filesRef.current.length >= PAPARAZZI_MAX_BATCH_PHOTOS) return;
    setCaptureBusy(true);
    try {
      const next = await camera.capture();
      if (next) addCapturedPhoto(next);
    } catch {
      setError("Foto belum dapat disiapkan. Coba ambil ulang.");
    } finally {
      setCaptureBusy(false);
    }
  }

  function finishCamera() { camera.stop(); setCaptureBusy(false); }

  function retakeMore() {
    if (busy || ticketRef.current.some(Boolean)) return;
    if (filesRef.current.length >= PAPARAZZI_MAX_BATCH_PHOTOS) { setError(`Maksimal ${PAPARAZZI_MAX_BATCH_PHOTOS} foto per kiriman.`); return; }
    setError(""); setFront(false); setCaptureBusy(false); void camera.start();
  }

  async function send(event: FormEvent) {
    event.preventDefault(); if (!files.length || !parsedInstagramHandle.success || (child && !guardian) || busy) return;
    setError(""); setProgress(0); setPhase("uploading");
    const controller = new AbortController(); abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 600_000);
    try {
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        if (!file) continue;
        let ticket = ticketRef.current[index] ?? null;
        if (ticket && !ticket.uploaded && ticket.uploadExpiresAt <= Date.now()) {
          ticket = null;
          ticketRef.current[index] = null;
        }
        if (!ticket) {
          const response = await fetch(`/api/public/paparazzi/${token}/uploads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: file.type, sizeBytes: file.size, instagramHandle: parsedInstagramHandle.data, includesChildData: child, guardianConsent: child && guardian }), signal: controller.signal });
          const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unggahan belum dapat dimulai.");
          ticket = { ...result, uploadExpiresAt: Date.now() + (result.expiresIn ?? 300) * 1_000 - 10_000, uploaded: false, completed: false };
          ticketRef.current[index] = ticket;
        }
        if (!ticket) throw new Error(`Tiket foto ${index + 1} belum siap.`);
        if (!ticket.uploaded) {
          const put = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type, ...ticket.uploadHeaders }, body: file, signal: controller.signal });
          if (!put.ok) throw new Error(`Foto ${index + 1} belum berhasil diunggah. Periksa koneksi lalu coba lagi.`);
          ticket.uploaded = true;
        }
        if (!ticket.completed) {
          const endpoint = `/api/public/paparazzi/${token}/photos/${ticket.photoId}`;
          const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receipt: ticket.receipt }), signal: controller.signal });
          const result = await response.json(); if (!response.ok) throw new Error(result.error || `Foto ${index + 1} belum dapat dikonfirmasi.`);
          ticket.completed = true;
        }
        setProgress(index + 1);
      }

      setPhase("processing"); setProgress(0);
      for (let attempt = 0; attempt < 100; attempt++) {
        const readyStates = await Promise.all(files.map(async (_, index) => {
          const ticket = ticketRef.current[index];
          if (!ticket) throw new Error(`Tiket foto ${index + 1} belum siap. Ketuk kirim lagi untuk melanjutkan.`);
          if (ticket.ready) return true;
          const endpoint = `/api/public/paparazzi/${token}/photos/${ticket.photoId}`;
          const response = await fetch(endpoint, { headers: { "x-paparazzi-receipt": ticket.receipt }, cache: "no-store", signal: controller.signal });
          const result = await response.json();
          if (!response.ok) {
            if ([410, 422].includes(response.status)) ticketRef.current[index] = null;
            throw new Error(result.error || `Status foto ${index + 1} belum dapat diperiksa.`);
          }
          ticket.ready = result.status === "READY";
          return ticket.ready;
        }));
        const readyCount = readyStates.filter(Boolean).length;
        setProgress(readyCount);
        if (readyCount === files.length) { setPhase("sent"); return; }
        await pause(1_200);
      }
      throw new Error("Foto sudah diunggah dan masih diproses. Ketuk Periksa unggahan untuk melanjutkan pemeriksaan.");
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error && !(cause instanceof TypeError) && !(cause instanceof SyntaxError) ? cause.message : "Foto belum berhasil dikirim. Periksa koneksi dan coba lagi.");
      else setError("Koneksi membutuhkan waktu lebih lama. Periksa koneksi dan coba lagi.");
      setPhase("idle");
    } finally { clearTimeout(timer); abortRef.current = null; }
  }

  return <main className="paparazzi-guest">
    <header className="paparazzi-brand"><span className="paparazzi-brand-icon"><Camera size={19} /></span><span>tamu<span className="muted">kita</span></span><span className="paparazzi-brand-label">PAPARAZI ACARA</span></header>
    <div className="paparazzi-guest-body">
      <div className="paparazzi-intro"><p className="eyebrow">KENANGAN KELUARGA</p><h1>{initial.title}</h1><p>Abadikan momen bersama keluarga.</p><span className="paparazzi-public-badge"><Users size={13} /> Galeri melalui QR atau tautan keluarga</span></div>
      {!initial.open && <section className="paparazzi-empty"><CameraOff size={32} /><h2>Pengumpulan foto sedang ditutup</h2><p>Pemilik acara belum membuka unggahan atau waktu unggah sudah berakhir. Minta informasi terbaru kepada pemilik acara.</p></section>}
      {initial.open && <>
        <input ref={galleryInput} aria-label="Pilih foto dari galeri" className="paparazzi-file-input" type="file" accept="image/*" multiple onChange={select} />
        <input ref={nativeInput} aria-label="Ambil dengan kamera HP" className="paparazzi-file-input" type="file" accept="image/*" capture="environment" onChange={select} />
        <dialog ref={uploadDialog} className={`paparazzi-upload-dialog${cameraFullScreen ? " paparazzi-upload-dialog--camera" : ""}`} aria-label="Unggah foto ke galeri keluarga" onCancel={event => { event.preventDefault(); dismissUpload(); }} onClose={() => { setUploadOpen(false); camera.stop(); }}>
          <div className={`paparazzi-upload-dialog-content${cameraFullScreen ? " paparazzi-upload-dialog-content--camera" : ""}`}>
            <div className="paparazzi-upload-dialog-heading"><div><p className="eyebrow">KENANGAN BERSAMA</p><h2 id="paparazzi-upload-title">Bagikan foto ke galeri keluarga</h2></div><button type="button" className="paparazzi-upload-dialog-close" aria-label="Tutup unggahan" onClick={dismissUpload} disabled={busy || (ticketRef.current.some(Boolean) && phase !== "sent")}><X size={19} /></button></div>
            <label className="paparazzi-instagram-field"><span>Nama Instagram <b>Wajib</b></span><input aria-label="Nama Instagram" type="text" value={instagramHandle} onChange={event => setInstagramHandle(event.target.value)} maxLength={31} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="@namakamu" required aria-invalid={instagramHandle.trim().length > 0 && !parsedInstagramHandle.success} aria-describedby="paparazzi-instagram-help" disabled={busy} /><small id="paparazzi-instagram-help">Nama ini hanya menjadi keterangan galeri, tidak dicetak pada foto.</small>{instagramHandle.trim().length > 0 && !parsedInstagramHandle.success && <small className="paparazzi-handle-error">Gunakan 1–30 huruf, angka, titik, atau garis bawah.</small>}</label>
        {camera.active || camera.opening ? <section className="paparazzi-camera" aria-label="Kamera acara">
          <div className="paparazzi-camera-bar"><span aria-live="polite">{camera.opening ? "Menghubungkan kamera…" : `Foto ${files.length}/${PAPARAZZI_MAX_BATCH_PHOTOS} · Story ${PAPARAZZI_STORY_WIDTH} × ${PAPARAZZI_STORY_HEIGHT}`}</span><button type="button" aria-label="Selesai memotret" onClick={finishCamera}><X size={21} /></button></div>
          {camera.active ? <div className="paparazzi-camera-view"><video ref={camera.videoRef} autoPlay playsInline muted aria-label="Pratinjau kamera" onLoadedData={() => camera.setReady(true)} onClick={() => { void camera.videoRef.current?.play(); }} /><span className="paparazzi-watermark-preview" aria-hidden="true"><Image src="/images/paparazi/wr-crest.png" alt="" width={56} height={56} unoptimized /></span></div> : <div className="paparazzi-camera-wait"><Loader2 className="paparazzi-spin" size={30} /><p>Izinkan penggunaan kamera pada browser.</p></div>}
          <div className="paparazzi-camera-controls"><button type="button" className="button button--outline" disabled={camera.opening || captureBusy || files.length >= PAPARAZZI_MAX_BATCH_PHOTOS} aria-label="Ganti kamera" onClick={() => { const next = !front; setFront(next); void camera.start(next ? "user" : "environment"); }}><SwitchCamera size={19} /></button><button type="button" className="paparazzi-shutter" disabled={!camera.ready || captureBusy || files.length >= PAPARAZZI_MAX_BATCH_PHOTOS} aria-label="Ambil foto" onClick={() => { void capturePhoto(); }}>{captureBusy ? <Loader2 size={24} className="paparazzi-spin" /> : <Camera size={26} />}</button><span>Ambil foto</span><button type="button" className="paparazzi-camera-finish" disabled={!files.length || captureBusy} onClick={finishCamera}>Selesai ({files.length})</button></div>
        </section> : phase === "sent" ? <section className="paparazzi-sent" role="status"><span><CheckCircle2 size={34} /></span><h2>{files.length} foto sudah diterima!</h2><p>Terima kasih sudah ikut mengabadikan momen. Buka galeri keluarga di bawah untuk melihat kenangan bersama.</p><button type="button" className="button button--dark button--wide" onClick={reset}><Camera size={17} /> Kirim foto lain</button><button type="button" className="text-link" onClick={() => { dismissUpload(); window.location.hash = "galeri-keluarga"; }}>Lihat galeri keluarga</button></section> : files.length && previews.length === files.length ? <section className="paparazzi-review">
          <div className="paparazzi-review-heading"><div><h2 ref={previewHeading} tabIndex={-1}>Siap dibagikan?</h2><p>{files.length} dari {PAPARAZZI_MAX_BATCH_PHOTOS} foto · hapus yang tidak cocok atau ambil ulang.</p></div><div className="paparazzi-review-actions"><button type="button" className="text-link" onClick={reset} disabled={busy || ticketRef.current.some(Boolean)}><RotateCcw size={14} /> Pilih ulang</button><button type="button" className="text-link" onClick={retakeMore} disabled={busy || files.length >= PAPARAZZI_MAX_BATCH_PHOTOS || ticketRef.current.some(Boolean)}><Camera size={14} /> Ambil lagi</button></div></div>
          <form onSubmit={send} className="paparazzi-consent-form">
            <div className="paparazzi-review-grid">
              {files.map((file, index) => <figure className="paparazzi-review-photo" key={`${file.name}-${file.lastModified}-${index}`}>
                <div className="paparazzi-photo-preview-frame">
                  <Image className="paparazzi-photo-preview" src={previews[index] ?? ""} alt={`Pratinjau foto ${index + 1} sebelum dikirim`} width={PAPARAZZI_STORY_WIDTH} height={PAPARAZZI_STORY_HEIGHT} unoptimized />
                  <span className="paparazzi-watermark-preview" aria-hidden="true"><Image src="/images/paparazi/wr-crest.png" alt="" width={56} height={56} unoptimized /></span>
                </div>
                <figcaption><span>Foto {index + 1}</span><button type="button" aria-label={`Hapus foto ${index + 1}`} onClick={() => removePhoto(index)} disabled={busy || Boolean(ticketRef.current[index])}><Trash2 size={15} /></button></figcaption>
              </figure>)}
            </div>
            {initial.childrenInvited && <label className="paparazzi-check"><input type="checkbox" checked={child} disabled={busy} onChange={event => { setChild(event.target.checked); setGuardian(false); }} /><span>Foto ini memuat anak di bawah 18 tahun.</span></label>}
            {initial.childrenInvited && child && <label className="paparazzi-check paparazzi-guardian"><input type="checkbox" checked={guardian} required disabled={busy} onChange={event => setGuardian(event.target.checked)} /><span>{PAPARAZZI_GUARDIAN_COPY}</span></label>}
            <button type="submit" className="button button--dark button--wide" disabled={busy || !parsedInstagramHandle.success || (child && !guardian)}>{busy ? <Loader2 size={18} className="paparazzi-spin" /> : <Upload size={18} />}{phase === "uploading" ? `Mengunggah foto ${progress}/${files.length}…` : phase === "processing" ? `Menyiapkan foto ${progress}/${files.length}…` : ticketRef.current.some(Boolean) ? "Periksa unggahan" : `Kirim ${files.length} foto ke galeri keluarga`}</button>
            {busy && <p role="status" className="paparazzi-processing-note">Jaga halaman tetap terbuka. Foto yang sudah diterima tidak akan dikirim ulang saat pemeriksaan diulang.</p>}
          </form>
        </section> : files.length ? <section className="paparazzi-start" role="status"><Loader2 className="paparazzi-spin" size={26} /><p>Menyiapkan pratinjau foto…</p></section> : <section className="paparazzi-start">
          <div className="paparazzi-camera-art" aria-hidden="true"><Camera size={55} strokeWidth={1} /><span><Check size={12} /></span></div>
          <h2>Momenmu, kenangan bersama</h2><p>Ambil foto sekarang atau pilih foto yang sudah ada di HP.</p>
          <button type="button" className="button button--dark button--wide" disabled={!parsedInstagramHandle.success} onClick={() => { setError(""); setFront(false); void camera.start(); }}><Camera size={18} /> Buka kamera</button>
          <button type="button" className="button button--outline button--wide" disabled={!parsedInstagramHandle.success} onClick={() => galleryInput.current?.click()}><ImagePlus size={18} /> Pilih dari galeri</button>
          <button type="button" className="text-link paparazzi-native-link" disabled={!parsedInstagramHandle.success} onClick={() => nativeInput.current?.click()}>Gunakan kamera bawaan HP</button>
        </section>}
        {(error || camera.error) && <p className="paparazzi-error" role="alert">{error || camera.error}</p>}
        <p className="paparazzi-guest-footnote">Maksimal {PAPARAZZI_MAX_BATCH_PHOTOS} foto per kiriman · JPG, PNG, atau WebP · Maksimal 10 MB per foto<br />Foto disimpan maksimal {initial.retentionDays} hari. Pemilik dapat mengunduhnya untuk arsip.</p>
          </div>
        </dialog>
      </>}
      <PaparazziPublicGallery token={token} available={initial.galleryAvailable} refreshKey={phase === "sent" ? ticketRef.current.map(ticket => ticket?.photoId).filter(Boolean).join(":") || "sent" : "view"} onAddPhoto={initial.open ? () => { setError(""); setUploadOpen(true); } : undefined} />
      {initial.invitationSlug && <div className="paparazzi-content-report"><PublicInvitationReport slug={initial.invitationSlug} label="Laporkan konten acara" /></div>}
    </div>
    <footer className="paparazzi-footer">Momen istimewa, jadi lebih dekat. <span>TamuKita</span></footer>
  </main>;
}
