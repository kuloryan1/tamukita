import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { auth } from "@/auth";
import { GuestbookModeration } from "@/components/guestbook-moderation";
import { getPrismaClient } from "@/lib/prisma";

export const metadata: Metadata = { title: "Moderasi buku tamu" };

export default async function InvitationGuestbookPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: { id, ownerId: userId, deletedAt: null, organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } },
    select: { id: true, title: true, slug: true },
  });
  if (!invitation) notFound();
  const entries = await prisma.guestbookEntry.findMany({
    where: { invitationId: invitation.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: { id: true, displayName: true, message: true, status: true, createdAt: true },
  });
  const pendingCount = entries.filter((entry) => entry.status === "PENDING").length;

  return <section className="dashboard-guestbook-page">
    <Link href="/dashboard" className="back-link"><ArrowLeft size={15} /> Kembali ke dashboard</Link>
    <div className="dashboard-page-heading guestbook-admin-heading"><div><p className="dashboard-date">MODERASI UCAPAN · tamukita.io/{invitation.slug}</p><h1><MessageCircle size={25} /> Buku tamu</h1><p>{invitation.title} · {pendingCount} ucapan menunggu persetujuan</p></div><Link href={`/${invitation.slug}`} target="_blank" className="button button--outline">Lihat undangan</Link></div>
    <GuestbookModeration invitationId={invitation.id} entries={entries.map((entry) => ({ ...entry, createdAt: entry.createdAt.toISOString() }))} />
  </section>;
}
