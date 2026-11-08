"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Download, Images, Loader2, RefreshCw, Share2, X } from "lucide-react";
import type { PaparazziGallery } from "@/lib/paparazzi";
import styles from "./paparazzi-public-gallery.module.css";

export function PaparazziPublicGallery({ token, available, refreshKey, onAddPhoto }: { token: string; available: boolean; refreshKey: string; onAddPhoto?: () => void }) {
  const [data, setData] = useState<PaparazziGallery>({ photos: [], nextCursor: null });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [expanded, setExpanded] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<PaparazziGallery["photos"][number] | null>(null);
  const [shareNotice, setShareNotice] = useState("");
  const requestNumber = useRef(0);
  const photoDialogRef = useRef<HTMLDialogElement>(null);
  const load = useCallback(async (cursor?: string) => {
    if (!available) return;
    const version = ++requestNumber.current;
    if (cursor) setLoading(true);
    const response = await fetch(`/api/public/paparazzi/${token}/gallery${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cache: "no-store" }).catch(() => null);
    const result = await response?.json().catch(() => null) as (PaparazziGallery & { error?: string }) | null;
    if (version !== requestNumber.current) return;
    setLoading(false);
    if (!response?.ok || !result?.photos) { if (response?.status === 404 || response?.status === 410) setData({ photos: [], nextCursor: null }); setError(result?.error || "Galeri belum dapat dimuat. Coba lagi."); return; }
    setError(""); setExpanded(Boolean(cursor));
    setData(previous => ({ ...result, photos: cursor ? [...previous.photos, ...result.photos.filter(photo => !previous.photos.some(old => old.id === photo.id))] : result.photos }));
  }, [available, token]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: A completed upload changes refreshKey to reload the public gallery.
  useEffect(() => { setExpanded(false); void load(); }, [load, refreshKey]);
  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden && !expanded) void load(); }, 5_000);
    return () => clearInterval(timer);
  }, [expanded, load]);
  useEffect(() => {
    const dialog = photoDialogRef.current;
    if (!dialog) return;
    if (selectedPhoto && !dialog.open) dialog.showModal();
    else if (!selectedPhoto && dialog.open) dialog.close();
  }, [selectedPhoto]);
  async function shareToInstagram(photo: PaparazziGallery["photos"][number]) {
    setShareNotice("");
    const photoUrl = `/api/public/paparazzi/${encodeURIComponent(token)}/gallery/${encodeURIComponent(photo.id)}`;
    try {
      const response = await fetch(`${photoUrl}?download=1`, { cache: "no-store" });
      if (!response.ok) throw new Error("Foto tidak dapat dimuat.");
      const blob = await response.blob();
      const file = new File([blob], `tamukita-${photo.id}.jpg`, { type: "image/jpeg" });
      if (typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Foto acara TamuKita", text: photo.instagramHandle ? `Momen dari ${photo.instagramHandle}` : "Momen dari tamu" });
          return;
        } catch (caught) {
          if (caught instanceof DOMException && caught.name === "AbortError") return;
        }
      }
      const objectUrl = URL.createObjectURL(blob);
      const download = document.createElement("a");
      download.href = objectUrl;
      download.download = file.name;
      download.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setShareNotice("Foto Story sudah diunduh. Pilih foto ini saat mengunggah ke Instagram.");
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setShareNotice("Foto belum dapat dibagikan. Coba unduh foto lalu bagikan dari Instagram.");
    }
  }
  if (!available) return null;
  return <section className="paparazzi-public-gallery" id="galeri-acara">
    <div className="paparazzi-gallery-heading"><div><p className="eyebrow">KENANGAN BERSAMA</p><h2>Galeri acara</h2><p>Foto dari para tamu langsung tampil setelah selesai diproses.</p></div><div className="paparazzi-gallery-actions">{onAddPhoto && <button className="button button--dark button--small" type="button" onClick={onAddPhoto}><Camera size={15} />Tambah foto</button>}<button className="button button--outline button--small" type="button" aria-label="Muat ulang galeri acara" onClick={() => { setExpanded(false); void load(); }}><RefreshCw size={16} /></button></div></div>
    {error && <p className="paparazzi-error" role="alert">{error}</p>}
    {data.photos.length ? <div className="paparazzi-public-photo-grid">{data.photos.map((photo, index) => {
      const href = `/api/public/paparazzi/${token}/gallery/${photo.id}`;
      return <figure key={photo.id} className="paparazzi-public-photo"><button className={styles.thumbnailButton} type="button" onClick={() => { setShareNotice(""); setSelectedPhoto(photo); }} aria-label={`Buka foto acara ${index + 1} dalam popup`}><Image src={href} alt={photo.instagramHandle ? `Foto acara dari ${photo.instagramHandle}` : `Foto acara dari tamu ${index + 1}`} width={photo.width ?? 1080} height={photo.height ?? 1920} unoptimized /></button><figcaption><span>{photo.instagramHandle ? `Foto dari ${photo.instagramHandle}` : "Foto tamu"}</span><a href={`${href}?download=1`} aria-label={`Unduh foto acara ${index + 1}`}><Download size={16} /></a></figcaption></figure>;
    })}</div> : <div className="paparazzi-gallery-empty"><Images size={28} /><h3>{loading ? "Menyiapkan galeri…" : "Jadilah yang pertama berbagi"}</h3><p>Foto yang dikirim tamu akan muncul di sini.</p></div>}
    {data.nextCursor && <button type="button" className="button button--outline paparazzi-load-more" disabled={loading} onClick={() => void load(data.nextCursor ?? undefined)}>{loading ? <Loader2 size={16} className="paparazzi-spin" /> : null} Lihat foto lainnya</button>}
    <dialog ref={photoDialogRef} className={styles.dialog} aria-label="Foto galeri Paparazi" onClose={() => { setSelectedPhoto(null); setShareNotice(""); }}>
      {selectedPhoto && <div className={styles.dialogContent}>
        <header className={styles.dialogHeader}><div><p className="eyebrow">KENANGAN BERSAMA</p><h2>{selectedPhoto.instagramHandle ? `Foto dari ${selectedPhoto.instagramHandle}` : "Foto dari tamu"}</h2></div><button type="button" className={styles.closeButton} aria-label="Tutup foto" onClick={() => photoDialogRef.current?.close()}><X size={19} /></button></header>
        <div className={styles.imageStage}><Image className={styles.photoImage} src={`/api/public/paparazzi/${encodeURIComponent(token)}/gallery/${encodeURIComponent(selectedPhoto.id)}`} alt={selectedPhoto.instagramHandle ? `Foto acara ber-watermark dari ${selectedPhoto.instagramHandle}` : "Foto acara ber-watermark"} width={selectedPhoto.width ?? 1080} height={selectedPhoto.height ?? 1920} unoptimized /></div>
        <div className={styles.photoActions}><a className="button button--outline" href={`/api/public/paparazzi/${encodeURIComponent(token)}/gallery/${encodeURIComponent(selectedPhoto.id)}?download=1`} download><Download size={16} />Unduh foto Story</a><button className="button button--dark" type="button" onClick={() => void shareToInstagram(selectedPhoto)}><Share2 size={17} />Bagikan ke Instagram</button></div>
        {shareNotice && <p className={styles.shareNotice} role="status">{shareNotice} <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer">Buka Instagram</a></p>}
      </div>}
    </dialog>
  </section>;
}
