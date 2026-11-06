import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { AdminEditorFeedback } from "@/components/admin-editor-feedback";
import styles from "@/components/admin-editor-feedback.module.css";
import { canReviewEditorFeedback, getAdminEditorFeedback } from "@/lib/editor-feedback";
import { getPrismaClient } from "@/lib/prisma";

export const metadata: Metadata = { title: "Keluhan editor" };

export default async function AdminEditorFeedbackPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const user = await getPrismaClient().user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  const role = user?.platformRole;
  if (!canReviewEditorFeedback(role)) redirect("/dashboard");

  const feedback = await getAdminEditorFeedback("active");
  return <main className={`admin-editor-feedback-page ${styles.page}`}>
    <div className={styles.pageTopbar}>
      <Link href={role === "SUPER_ADMIN" ? "/admin" : "/dashboard"} className={styles.backLink}><ArrowLeft size={16} aria-hidden="true" />{role === "SUPER_ADMIN" ? "Kembali ke admin" : "Kembali ke dashboard"}</Link>
      <span className={styles.topbarLabel}>TAMUKITA <span aria-hidden="true">/</span> PUSAT BANTUAN</span>
    </div>
    <header className={styles.pageHeading}>
      <div>
        <p className={styles.eyebrow}>DUKUNGAN PRODUK</p>
        <h1>Keluhan editor</h1>
        <p className={styles.pageDescription}>Tinjau kendala pelanggan dan tindak lanjuti setiap laporan.</p>
      </div>
      <div className={styles.accessNote}><ShieldCheck size={16} aria-hidden="true" /><span>Super Admin &amp; Support</span></div>
    </header>
    <AdminEditorFeedback initialFeedback={feedback.map((item) => ({ ...item, createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString() }))} />
  </main>;
}
