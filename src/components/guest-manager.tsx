"use client";

import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";
import { GuestRecipientEditor } from "@/components/guest-recipient-editor";

type RsvpResponse = { id: string; displayName: string; attendance: "ATTENDING" | "DECLINED" | "MAYBE"; attendeeCount: number; respondedAt: string };

export function GuestManager({ invitationId, slug, eventTitle, isPublished, initialResponses }: {
  invitationId: string;
  slug: string;
  eventTitle: string;
  isPublished: boolean;
  initialResponses: RsvpResponse[];
}) {
  return <div className="guest-manager">
    <Link href="/dashboard#invitations" className="back-link"><ArrowLeft size={15} /> Kembali ke undangan</Link>
    <div className="dashboard-page-heading guest-manager-heading"><div><p className="dashboard-date">DAFTAR TAMU · tamukita.io/{slug}</p><h1><Users size={25} /> Tamu undangan</h1><p>Kelola nama tamu, tautan undangan pribadi, dan konfirmasi kehadiran.</p></div><Link href={`/${slug}`} target="_blank" className="button button--outline">Lihat undangan</Link></div>
    <GuestRecipientEditor key={invitationId} invitationId={invitationId} slug={slug} eventTitle={eventTitle} isPublished={isPublished} />
    <section className="dashboard-content-card guest-list-card"><div className="card-heading"><div><h2>Semua konfirmasi kehadiran</h2><p>{initialResponses.length} jawaban terbaru, termasuk dari tamu tanpa tautan pribadi.</p></div></div>{initialResponses.length === 0 ? <div className="dashboard-empty-state"><h3>Belum ada konfirmasi</h3><p>Jawaban konfirmasi kehadiran akan muncul di sini setelah tamu mengirimkannya.</p></div> : initialResponses.map((response) => <div className="guest-list-row" key={response.id}><div><b>{response.displayName}</b><small>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(response.respondedAt))}</small></div><span className={`status-pill ${response.attendance === "ATTENDING" ? "status-pill--live" : "status-pill--draft"}`}><i />{response.attendance === "ATTENDING" ? `Hadir · ${response.attendeeCount}` : response.attendance === "DECLINED" ? "Berhalangan" : "Belum memutuskan"}</span></div>)}</section>
  </div>;
}
