"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Camera, CameraOff, Check, CheckCircle2, ImagePlus, Loader2, Users, RotateCcw, SwitchCamera, Upload, X } from "lucide-react";
import { usePaparazziCamera } from "@/components/use-paparazzi-camera";
import { PaparazziPublicGallery } from "@/components/paparazzi-public-gallery";
import { PublicInvitationReport } from "@/components/public-invitation-report";
import { PAPARAZZI_CONSENT_COPY, PAPARAZZI_GUARDIAN_COPY, type PaparazziPublicAlbum } from "@/lib/paparazzi";

type Ticket = { photoId: string; receipt: string; uploadUrl: string; uploadExpiresAt: number; uploaded: boolean; completed: boolean };
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function PaparazziGuest({ token, initial }: { token: string; initial: PaparazziPublicAlbum }) {
  const camera = usePaparazziCamera();
  const galleryInput = useRef<HTMLInputElement>(null); const nativeInput = useRef<HTMLInputElement>(null);
  const ticketRef = useRef<Ticket | null>(null); const abortRef = useRef<AbortController | null>(null);
  const previewHeading = useRef<HTMLHeadingElement>(null);
  const [file, setFile] = useState<File | null>(null); const [preview, setPreview] = useState("");
  const [consent, setConsent] = useState(false); const [child, setChild] = useState(false); const [guardian, setGuardian] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "processing" | "sent">("idle");
  const [error, setError] = useState(""); const [front, setFront] = useState(false);
  const busy = phase === "uploading" || phase === "processing";

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
  function reset() { camera.stop(); setFile(null); ticketRef.current = null; setPhase("idle"); setConsent(false); setChild(false); setGuardian(false); setError(""); }

  async function send(event: FormEvent) {
    event.preventDefault(); if (!file || !consent || (child && !guardian) || busy) return;
    setError(""); setPhase("uploading");
    const controller = new AbortController(); abortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      if (ticketRef.current && !ticketRef.current.uploaded && ticketRef.current.uploadExpiresAt <= Date.now()) ticketRef.current = null;
      if (!ticketRef.current) {
        const response = await fetch(`/api/public/paparazzi/${token}/uploads`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentType: file.type, sizeBytes: file.size, consent, includesChildData: child, guardianConsent: child && guardian }), signal: controller.signal });
        const result = await response.json(); if (!response.ok) throw new Error(result.error || "Unggahan belum dapat dimulai.");
        ticketRef.current = { ...result, uploadExpiresAt: Date.now() + (result.expiresIn ?? 300) * 1_000 - 10_000, uploaded: false, completed: false };
      }
      const ticket = ticketRef.current;
      if (!ticket) throw new Error("Unggahan belum siap.");
      if (!ticket.uploaded) {
        const put = await fetch(ticket.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file, signal: controller.signal });
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
      {!initial.open ? <section className="paparazzi-empty"><CameraOff size={32} /><h2>Pengumpulan foto sedang ditutup</h2><p>Pemilik acara belum membuka unggahan atau waktu unggah sudah berakhir. Minta informasi terbaru kepada pemilik acara.</p></section> : <>
        <input ref={galleryInput} aria-label="Pilih foto dari galeri" className="paparazzi-file-input" type="file" accept="image/*" onChange={select} />
        <input ref={nativeInput} aria-label="Ambil dengan kamera HP" className="paparazzi-file-input" type="file" accept="image/*" capture="environment" onChange={select} />
        {camera.active || camera.opening ? <section className="paparazzi-camera" aria-label="Kamera acara">
          <div className="paparazzi-camera-bar"><span>{camera.opening ? "Menunggu izin kamera" : "Cari momen terbaikmu"}</span><button type="button" aria-label="Tutup kamera" onClick={camera.stop}><X size={21} /></button></div>
          {camera.active ? <video ref={camera.videoRef} autoPlay playsInline muted aria-label="Pratinjau kamera" onLoadedData={() => camera.setReady(true)} onClick={() => { void camera.videoRef.current?.play(); }} /> : <div className="paparazzi-camera-wait"><Loader2 className="paparazzi-spin" size={30} /><p>Izinkan penggunaan kamera pada browser.</p></div>}
          <div className="paparazzi-camera-controls"><button type="button" className="button button--outline" disabled={camera.opening} aria-label="Ganti kamera" onClick={() => { const next = !front; setFront(next); void camera.start(next ? "user" : "environment"); }}><SwitchCamera size={19} /></button><button type="button" className="paparazzi-shutter" disabled={!camera.ready} aria-label="Ambil foto" onClick={() => { void camera.capture().then(chooseFile); }}><Camera size={26} /></button><span>Ambil foto</span></div>
        </section> : phase === "sent" ? <section className="paparazzi-sent" role="status"><span><CheckCircle2 size={34} /></span><h2>Foto sudah diterima!</h2><p>Terima kasih sudah ikut mengabadikan momen. Buka galeri acara di bawah untuk melihat kenangan bersama.</p><button type="button" className="button button--dark button--wide" onClick={reset}><Camera size={17} /> Kirim foto lain</button><a href="#galeri-acara" className="text-link">Lihat galeri acara</a></section> : file && preview ? <section className="paparazzi-review">
          <div className="paparazzi-review-heading"><h2 ref={previewHeading} tabIndex={-1}>Siap dibagikan?</h2><button type="button" className="text-link" onClick={reset} disabled={busy}><RotateCcw size={14} /> Pilih ulang</button></div>
          <Image className="paparazzi-photo-preview" src={preview} alt="Pratinjau foto sebelum dikirim" width={720} height={900} unoptimized />
          <form onSubmit={send} className="paparazzi-consent-form">
            <label className="paparazzi-check"><input type="checkbox" checked={consent} required disabled={busy} onChange={event => setConsent(event.target.checked)} /><span>{PAPARAZZI_CONSENT_COPY}</span></label>
            <label className="paparazzi-check"><input type="checkbox" checked={child} disabled={busy} onChange={event => { setChild(event.target.checked); setGuardian(false); }} /><span>Foto ini memuat anak di bawah 18 tahun.</span></label>
            {child && <label className="paparazzi-check paparazzi-guardian"><input type="checkbox" checked={guardian} required disabled={busy} onChange={event => setGuardian(event.target.checked)} /><span>{PAPARAZZI_GUARDIAN_COPY}</span></label>}
            <button type="submit" className="button button--dark button--wide" disabled={busy || !consent || (child && !guardian)}>{busy ? <Loader2 size={18} className="paparazzi-spin" /> : <Upload size={18} />}{phase === "uploading" ? "Mengunggah foto…" : phase === "processing" ? "Menyiapkan foto untuk galeri…" : ticketRef.current?.uploaded ? "Periksa unggahan" : "Bagikan ke galeri acara"}</button>
            {busy && <p role="status" className="paparazzi-processing-note">Jaga halaman tetap terbuka. Foto tidak akan dikirim dua kali saat pemeriksaan diulang.</p>}
          </form>
        </section> : <section className="paparazzi-start">
          <div className="paparazzi-camera-art" aria-hidden="true"><Camera size={55} strokeWidth={1} /><span><Check size={12} /></span></div>
          <h2>Momenmu, kenangan bersama</h2><p>Ambil foto sekarang atau pilih foto yang sudah ada di HP.</p>
          <button type="button" className="button button--dark button--wide" onClick={() => { setError(""); setFront(false); void camera.start(); }}><Camera size={18} /> Buka kamera</button>
          <button type="button" className="button button--outline button--wide" onClick={() => galleryInput.current?.click()}><ImagePlus size={18} /> Pilih dari galeri</button>
          <button type="button" className="text-link paparazzi-native-link" onClick={() => nativeInput.current?.click()}>Gunakan kamera bawaan HP</button>
        </section>}
        {(error || camera.error) && <p className="paparazzi-error" role="alert">{error || camera.error}</p>}
        <p className="paparazzi-guest-footnote">JPG, PNG, atau WebP · Maksimal 10 MB per foto<br />Foto disimpan maksimal {initial.retentionDays} hari. Pemilik dapat mengunduhnya untuk arsip.</p>
      </>}
      <PaparazziPublicGallery token={token} available={initial.galleryAvailable} refreshKey={phase === "sent" ? ticketRef.current?.photoId ?? "sent" : "view"} />
      {initial.invitationSlug && <div className="paparazzi-content-report"><PublicInvitationReport slug={initial.invitationSlug} label="Laporkan konten acara" /></div>}
    </div>
    <footer className="paparazzi-footer">Momen istimewa, jadi lebih dekat. <span>TamuKita</span></footer>
  </main>;
}
