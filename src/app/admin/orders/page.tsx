import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ReceiptText } from "lucide-react";
import { auth } from "@/auth";
import { AdminOrders } from "@/components/admin-orders";
import { getPrismaClient } from "@/lib/prisma";

export const metadata: Metadata = { title: "Order & refund · Admin TamuKita" };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const user = await getPrismaClient().user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole !== "SUPER_ADMIN" && user?.platformRole !== "FINANCE") redirect("/dashboard");
  return <div className="admin-page"><Link className="admin-back-link" href="/admin"><ArrowLeft size={15} /> Kembali ke admin</Link><div className="dashboard-page-heading"><div><p className="dashboard-date">ADMIN PLATFORM · FINANCE</p><h1><ReceiptText size={24} /> Order & refund</h1><p>Lihat transaksi dan ajukan refund penuh atau sebagian.</p></div></div><AdminOrders /></div>;
}
