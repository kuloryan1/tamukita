import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { auth } from "@/auth";
import { AdminPlans } from "@/components/admin-plans";
import { getAdminPlanDirectory } from "@/lib/admin-plans";
import { getPrismaClient } from "@/lib/prisma";

export const metadata: Metadata = { title: "Paket dan entitlement · Admin TamuKita" };
export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const admin = await getPrismaClient().user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") redirect("/dashboard");
  const plans = await getAdminPlanDirectory("", 1);

  return <div className="admin-page">
    <Link className="admin-back-link" href="/admin"><ArrowLeft size={15} /> Kembali ke admin</Link>
    <div className="dashboard-page-heading"><div><p className="dashboard-date">ADMIN PLATFORM · BILLING</p><h1><PackageCheck size={24} /> Paket dan entitlement</h1><p>Atur katalog paket dan snapshot hak fitur secara terpisah dari data transaksi lama.</p></div></div>
    <AdminPlans initial={plans} />
  </div>;
}
