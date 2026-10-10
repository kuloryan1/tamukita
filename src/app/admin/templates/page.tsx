import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Layers3 } from "lucide-react";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { getAdminTemplates } from "@/lib/admin-templates";
import { AdminTemplateReview } from "@/components/admin-template-review";

export const metadata: Metadata = { title: "Review template · Admin TamuKita" };
export const dynamic = "force-dynamic";

export default async function AdminTemplatesPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const user = await getPrismaClient().user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (!user || !["SUPER_ADMIN", "FINANCE", "CONTENT_REVIEWER"].includes(user.platformRole)) redirect("/dashboard");
  const templates = await getAdminTemplates();
  return <div className="admin-page"><Link className="admin-back-link" href="/admin"><ArrowLeft size={15} /> Kembali ke admin</Link><div className="dashboard-page-heading"><div><p className="dashboard-date">ADMIN PLATFORM · MARKETPLACE</p><h1><Layers3 size={24} /> Review template</h1><p>Tinjau manifest, publikasikan versi, dan kelola harga katalog.</p></div></div><AdminTemplateReview templates={templates} canSetPricing={user.platformRole === "SUPER_ADMIN" || user.platformRole === "FINANCE"} /></div>;
}
