import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageSquareText } from "lucide-react";
import { auth } from "@/auth";
import { AdminEditorFeedback } from "@/components/admin-editor-feedback";
import { canReviewEditorFeedback, getAdminEditorFeedback } from "@/lib/editor-feedback";
import { getPrismaClient } from "@/lib/prisma";

export const metadata: Metadata = { title: "Masukan editor" };

export default async function AdminEditorFeedbackPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const user = await getPrismaClient().user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  const role = user?.platformRole;
  if (!canReviewEditorFeedback(role)) redirect("/dashboard");

  const feedback = await getAdminEditorFeedback("active");
  return <section className="admin-moderation-page admin-editor-feedback-page">
    <Link href={role === "SUPER_ADMIN" ? "/admin" : "/dashboard"} className="back-link"><ArrowLeft size={15} /> Kembali</Link>
    <div className="dashboard-page-heading"><div><p className="dashboard-date">TIGAKAKI · DUKUNGAN PRODUK</p><h1><MessageSquareText size={25} /> Keluhan editor</h1><p>Tinjau laporan pelanggan dan catat tindak lanjutnya. Pesan hanya terlihat oleh Super Admin dan Support.</p></div></div>
    <AdminEditorFeedback initialFeedback={feedback.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))} />
  </section>;
}
