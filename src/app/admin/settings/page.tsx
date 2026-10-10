import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Settings2 } from "lucide-react";
import { auth } from "@/auth";
import { AdminSettings } from "@/components/admin-settings";
import { getPrismaClient } from "@/lib/prisma";
import { getPlatformSettingsOverview } from "@/lib/platform-settings";

export const metadata: Metadata = { title: "Pengaturan platform · Admin TamuKita" };
export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const user = await getPrismaClient().user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole !== "SUPER_ADMIN") redirect("/dashboard");
  const settings = await getPlatformSettingsOverview();
  return <div className="admin-page"><Link className="admin-back-link" href="/admin"><ArrowLeft size={15} /> Kembali ke admin</Link><div className="dashboard-page-heading"><div><p className="dashboard-date">ADMIN PLATFORM · SETTINGS</p><h1><Settings2 size={24} /> Pengaturan platform</h1><p>Kelola biaya aktivasi, harga kredit, masa hosting, dan kesiapan integrasi.</p></div></div><AdminSettings initial={settings} /></div>;
}
