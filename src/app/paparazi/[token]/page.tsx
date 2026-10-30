import { notFound } from "next/navigation";
import { PaparazziGuest } from "@/components/paparazzi-guest";
import { getPublicPaparazziAlbum } from "@/lib/paparazzi-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Paparazi acara", robots: { index: false, follow: false } };

export default async function PaparazziGuestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const album = await getPublicPaparazziAlbum(token); if (!album) notFound();
  return <PaparazziGuest token={token} initial={album} />;
}
