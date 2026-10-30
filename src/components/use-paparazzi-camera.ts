"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function usePaparazziCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);
  const [active, setActive] = useState(false);
  const [opening, setOpening] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const stop = useCallback(() => {
    requestRef.current += 1;
    streamRef.current?.getTracks().forEach(track => { track.stop(); }); streamRef.current = null;
    setActive(false); setOpening(false); setReady(false);
    setError("");
  }, []);

  useEffect(() => {
    const hide = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", hide);
    return () => { document.removeEventListener("visibilitychange", hide); requestRef.current += 1; streamRef.current?.getTracks().forEach(track => { track.stop(); }); };
  }, [stop]);

  async function start(facing: "environment" | "user" = "environment") {
    stop(); setError("");
    if (!navigator.mediaDevices?.getUserMedia) { setError("Kamera browser belum tersedia. Gunakan kamera bawaan HP atau pilih foto dari galeri."); return; }
    const request = ++requestRef.current; setOpening(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      if (request !== requestRef.current || document.hidden) { stream.getTracks().forEach(track => { track.stop(); }); return; }
      streamRef.current = stream; setOpening(false); setActive(true);
    } catch (cause) {
      if (request !== requestRef.current) return;
      setOpening(false);
      setError(cause instanceof DOMException && cause.name === "NotAllowedError" ? "Izin kamera belum diberikan. Izinkan kamera di pengaturan browser, gunakan kamera bawaan HP, atau pilih foto dari galeri." : "Kamera belum dapat dibuka. Tutup aplikasi kamera lain atau pilih foto dari galeri.");
    }
  }

  useEffect(() => {
    if (!active || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => setError("Ketuk tayangan kamera untuk mulai."));
  }, [active]);

  async function capture() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) { setError("Kamera sedang disiapkan. Tunggu sebentar."); return null; }
    const scale = Math.min(1, 1920 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas"); canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext("2d"); if (!context) { setError("Foto belum dapat diambil. Gunakan kamera bawaan HP."); return null; }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) { setError("Foto belum dapat disiapkan. Coba lagi."); return null; }
    stop(); return new File([blob], "foto-acara.jpg", { type: "image/jpeg" });
  }
  return { videoRef, active, opening, ready, setReady, error, start, stop, capture };
}
