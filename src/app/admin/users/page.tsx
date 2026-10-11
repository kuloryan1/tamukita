import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { auth } from "@/auth";
import { AdminUsers } from "@/components/admin-users";
import { getPrismaClient } from "@/lib/prisma";

export const metadata: Metadata = { title: "Pengguna platform · Admin TamuKita" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const admin = await getPrismaClient().user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") redirect("/dashboard");

  return <div className="admin-page">
    <Link className="admin-back-link" href="/admin"><ArrowLeft size={15} /> Kembali ke admin</Link>
    <div className="dashboard-page-heading"><div><p className="dashboard-date">ADMIN PLATFORM · AKUN</p><h1><Users size={24} /> Pengguna platform</h1><p>Cari akun pelanggan dan kelola peran staf. Perubahan peran dicatat di audit log; peran reseller dikelola lewat workspace.</p></div></div>
    <AdminUsers actorId={userId} />
  </div>;
}
