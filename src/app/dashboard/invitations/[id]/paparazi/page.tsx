import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";
import { auth } from "@/auth";
import { PaparazziOwner } from "@/components/paparazzi-owner";
import { getOwnerPaparazziAlbum } from "@/lib/paparazzi-server";
import { paparazziPhotoIdSchema } from "@/lib/paparazzi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paparazi acara" };

export default async function PaparazziOwnerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user?.id) redirect("/login");
  const { id } = await params; if (!paparazziPhotoIdSchema.safeParse(id).success) notFound();
  const data = await getOwnerPaparazziAlbum(session.user.id, id); if (!data) notFound();
  return <section className="dashboard-paparazzi-page">
    <Link href="/dashboard#invitations" className="back-link"><ArrowLeft size={15} /> Kembali ke undangan</Link>
    <div className="dashboard-page-heading"><div><p className="dashboard-date">MOMEN DARI PARA TAMU</p><h1><Camera size={27} /> Paparazi acara</h1><p>{data.invitation.title} · Kamera dan galeri publik lewat QR</p></div></div>
    <PaparazziOwner initial={data} />
  </section>;
}
