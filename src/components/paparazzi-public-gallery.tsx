"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Images, Loader2, RefreshCw } from "lucide-react";
import type { PaparazziGallery } from "@/lib/paparazzi";

export function PaparazziPublicGallery({ token, available, refreshKey }: { token: string; available: boolean; refreshKey: string }) {
  const [data, setData] = useState<PaparazziGallery>({ photos: [], nextCursor: null });
  const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [expanded, setExpanded] = useState(false);
  const requestNumber = useRef(0);
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
  if (!available) return null;
  return <section className="paparazzi-public-gallery" id="galeri-acara">
    <div className="paparazzi-gallery-heading"><div><p className="eyebrow">KENANGAN BERSAMA</p><h2>Galeri acara</h2><p>Foto dari para tamu langsung tampil setelah selesai diproses.</p></div><button className="button button--outline button--small" type="button" aria-label="Muat ulang galeri acara" onClick={() => { setExpanded(false); void load(); }}><RefreshCw size={16} /></button></div>
    {error && <p className="paparazzi-error" role="alert">{error}</p>}
    {data.photos.length ? <div className="paparazzi-public-photo-grid">{data.photos.map((photo, index) => {
      const href = `/api/public/paparazzi/${token}/gallery/${photo.id}`;
      return <figure key={photo.id} className="paparazzi-public-photo"><a href={href} target="_blank" rel="noreferrer" aria-label={`Buka foto acara ${index + 1}`}><Image src={href} alt={`Foto acara dari tamu ${index + 1}`} width={photo.width ?? 1200} height={photo.height ?? 900} unoptimized /></a><figcaption><span>Foto tamu</span><a href={`${href}?download=1`} aria-label={`Unduh foto acara ${index + 1}`}><Download size={16} /></a></figcaption></figure>;
    })}</div> : <div className="paparazzi-gallery-empty"><Images size={28} /><h3>{loading ? "Menyiapkan galeri…" : "Jadilah yang pertama berbagi"}</h3><p>Foto yang dikirim tamu akan muncul di sini.</p></div>}
    {data.nextCursor && <button type="button" className="button button--outline paparazzi-load-more" disabled={loading} onClick={() => void load(data.nextCursor ?? undefined)}>{loading ? <Loader2 size={16} className="paparazzi-spin" /> : null} Lihat foto lainnya</button>}
  </section>;
}
