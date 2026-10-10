import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Flag } from "lucide-react";
import { auth } from "@/auth";
import { AdminContentModeration } from "@/components/admin-content-moderation";
import { canReviewContentReports, getAdminContentReports } from "@/lib/admin-content-reports";
import { getPrismaClient } from "@/lib/prisma";

export const metadata: Metadata = { title: "Moderasi konten" };

export default async function AdminModerationPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const user = await getPrismaClient().user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  const role = user?.platformRole;
  if (!canReviewContentReports(role)) redirect("/dashboard");

  const reports = await getAdminContentReports("pending");
  return <section className="admin-moderation-page">
    <Link href={role === "SUPER_ADMIN" ? "/admin" : "/dashboard"} className="back-link"><ArrowLeft size={15} /> Kembali</Link>
    <div className="dashboard-page-heading"><div><p className="dashboard-date">TIGAKAKI · TRUST & SAFETY</p><h1><Flag size={25} /> Moderasi konten</h1><p>Tinjau ucapan yang dilaporkan tamu. Laporan hanya menyimpan alasan dan sidik anonim untuk mencegah duplikasi.</p></div></div>
    <AdminContentModeration initialReports={reports.map((report) => ({ ...report, createdAt: report.createdAt.toISOString(), reviewedAt: report.reviewedAt?.toISOString() ?? null, guestbookEntry: { ...report.guestbookEntry, createdAt: report.guestbookEntry.createdAt.toISOString() } }))} />
  </section>;
}
