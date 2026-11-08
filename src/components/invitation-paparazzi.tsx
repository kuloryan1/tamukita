"use client";

import Image from "next/image";
import { ArrowUpRight, Camera, QrCode } from "lucide-react";

export function InvitationPaparazzi({ token }: { token: string }) {
  const guestUrl = `/paparazi/${encodeURIComponent(token)}`;

  return (
    <section className="invitation-paparazzi" aria-labelledby="invitation-paparazzi-title">
      <div className="invitation-paparazzi-inner">
        <div className="invitation-paparazzi-qr">
          <Image src={`/api/public/paparazzi/${encodeURIComponent(token)}/qr`} alt="QR untuk membuka kamera Paparazi acara" width={240} height={240} unoptimized />
        </div>
        <div className="invitation-paparazzi-copy">
          <span className="eyebrow"><Camera size={14} /> PAPARAZI ACARA</span>
          <h2 id="invitation-paparazzi-title">Bagikan momen <em>bersama.</em></h2>
          <p>Pindai QR untuk mengirim foto acara, atau buka galeri melalui tautan berikut.</p>
          <span className="invitation-paparazzi-status is-open" role="status">Unggahan foto dibuka</span>
          <a href={guestUrl} target="_blank" rel="noopener noreferrer"><QrCode size={16} /> Buka Paparazi <ArrowUpRight size={14} /></a>
        </div>
      </div>
    </section>
  );
}
