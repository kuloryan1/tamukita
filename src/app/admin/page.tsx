import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { AdminResellers } from "@/components/admin-resellers";
import { AdminOverview } from "@/components/admin-overview";
import { AdminInvitations } from "@/components/admin-invitations";
import { AdminManagedInvitation } from "@/components/admin-managed-invitation";
import { AdminOrders } from "@/components/admin-orders";
import { AdminWorkspaces } from "@/components/admin-workspaces";
import { AdminTemplateReview } from "@/components/admin-template-review";
import { getPrismaClient } from "@/lib/prisma";
import { templates } from "@/lib/templates";
import { ensureTemplateVersion } from "@/lib/invitation-server";
import { getAdminTemplates } from "@/lib/admin-templates";

export const metadata: Metadata = { title: "Admin TamuKita" };

export default async function AdminPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole !== "SUPER_ADMIN") redirect("/dashboard");
  await Promise.all(templates.map((template) => ensureTemplateVersion(template.slug)));
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const publicViewsStart = new Date(Date.UTC(thirtyDaysAgo.getUTCFullYear(), thirtyDaysAgo.getUTCMonth(), thirtyDaysAgo.getUTCDate()));
  const [profiles, userCount, newUserCount, organizationCount, activeInvitationCount, initialPublicationCount, publicViews, paidOrderSummary, successfulRefundSummary, pendingOrderCount, pendingPaymentCount, liveResellerCount, templatesInReviewCount, failedMediaCount, failedNotificationCount, recentOrders, recentAudit, recentInvitations, templateRows] = await Promise.all([
    prisma.resellerProfile.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { organization: { select: { name: true, memberships: { where: { role: "OWNER" }, take: 1, select: { user: { select: { name: true, email: true } } } } } } },
    }),
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.organization.count({ where: { type: { not: "PLATFORM" }, status: "ACTIVE" } }),
    prisma.invitation.count({ where: { deletedAt: null, status: "PUBLISHED", OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
    prisma.auditLog.count({
      where: {
        targetType: "Invitation",
        action: { in: ["invitation.published_free_template", "invitation.published_after_payment", "invitation.published_with_existing_license", "invitation.published_by_reseller"] },
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.analyticsDaily.aggregate({ where: { metricKey: "invitation_views", date: { gte: publicViewsStart } }, _sum: { metricValue: true } }),
    prisma.order.aggregate({ where: { currency: "IDR", paidAt: { not: null }, status: { in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] } }, _count: { _all: true }, _sum: { totalAmount: true } }),
    prisma.refund.aggregate({ where: { currency: "IDR", status: "SUCCEEDED" }, _sum: { amount: true } }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.paymentSession.count({ where: { status: "PENDING" } }),
    prisma.resellerProfile.count({ where: { status: "APPROVED" } }),
    prisma.template.count({ where: { status: { in: ["IN_REVIEW", "UPDATE_IN_REVIEW"] } } }),
    prisma.mediaAsset.count({ where: { status: "FAILED", deletedAt: null } }),
    prisma.notificationJob.count({ where: { failedAt: { not: null } } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        buyer: { select: { name: true, email: true } },
        organization: { select: { name: true } },
        items: { orderBy: { createdAt: "asc" }, select: { sku: true, quantity: true } },
        paymentSessions: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { actor: { select: { name: true, email: true } }, organization: { select: { name: true } } },
    }),
    prisma.invitation.findMany({
      where: { deletedAt: null, status: { in: ["PUBLISHED", "SUSPENDED"] } },
      orderBy: { updatedAt: "desc" },
      take: 40,
      include: { owner: { select: { name: true, email: true } }, organization: { select: { name: true } } },
    }),
    getAdminTemplates(),
  ]);
  const applications = profiles.map((profile) => ({
    id: profile.id,
    businessName: profile.businessName,
    organizationName: profile.organization.name,
    ownerName: profile.organization.memberships[0]?.user.name ?? "Pemilik workspace",
    email: profile.organization.memberships[0]?.user.email ?? "Email tidak tersedia",
    createdAt: profile.createdAt.toISOString(),
  }));
  const grossPayments = paidOrderSummary._sum.totalAmount ?? 0;
  const successfulRefunds = successfulRefundSummary._sum.amount ?? 0;
  const netPayments = grossPayments - successfulRefunds;
  const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
  const metrics = [
    { label: "Akun", value: userCount, detail: "Semua akun terdaftar", icon: "users" as const },
    { label: "Akun baru 30 hari", value: newUserCount, detail: "Akun yang mendaftar 30 hari terakhir", icon: "users" as const },
    { label: "Workspace", value: organizationCount, detail: "Workspace aktif", icon: "store" as const },
    { label: "Undangan aktif", value: activeInvitationCount, detail: "Halaman publik", icon: "invite" as const },
    { label: "Publikasi awal 30 hari", value: initialPublicationCount, detail: "Aktivasi awal; edit undangan aktif tidak dihitung", icon: "invite" as const },
    { label: "Tampilan publik 30 hari", value: (publicViews._sum.metricValue ?? BigInt(0)).toLocaleString("id-ID"), detail: "Total tampilan, bukan pengunjung unik", icon: "invite" as const },
    { label: "Pembayaran sukses", value: paidOrderSummary._count._all, detail: "Order IDR yang telah dibayar", icon: "payment" as const },
    { label: "Penerimaan neto (IDR)", value: netPayments, detail: `${rupiah.format(grossPayments)} diterima · ${rupiah.format(successfulRefunds)} refund sukses · sebelum biaya gateway`, icon: "payment" as const },
    { label: "Order pending", value: pendingOrderCount, detail: `${pendingPaymentCount} sesi pembayaran berjalan`, icon: "payment" as const },
    { label: "Reseller aktif", value: liveResellerCount, detail: `${profiles.length} pengajuan menunggu`, icon: "store" as const },
    { label: "Template review", value: templatesInReviewCount, detail: "Menunggu pemeriksaan", icon: "template" as const },
    { label: "Media gagal", value: failedMediaCount, detail: "Perlu ditinjau ulang", icon: "media" as const },
    { label: "Email gagal", value: failedNotificationCount, detail: "Job notifikasi yang perlu dicek", icon: "notification" as const },
  ];
  const orderRows = recentOrders.map((order) => ({
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    buyer: order.buyer.name ?? "Pengguna",
    email: order.buyer.email ?? "",
    organization: order.organization.name,
    item: order.items.length > 0 ? order.items.map((item) => `${item.sku}${item.quantity > 1 ? ` × ${item.quantity}` : ""}`).join(" + ") : "Order kosong",
    paymentStatus: order.paymentSessions[0]?.status ?? "TANPA PEMBAYARAN",
  }));
  const auditRows = recentAudit.map((entry) => ({
    id: entry.id,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    createdAt: entry.createdAt.toISOString(),
    actor: entry.actor?.name ?? entry.actor?.email ?? "Sistem",
    organization: entry.organization?.name ?? "Platform",
  }));
  const invitationRows = recentInvitations.map((invitation) => ({
    id: invitation.id,
    title: invitation.title,
    slug: invitation.slug,
    status: invitation.status as "PUBLISHED" | "SUSPENDED",
    owner: invitation.owner.name ?? "Pelanggan",
    email: invitation.owner.email ?? "",
    organization: invitation.organization.name,
    updatedAt: invitation.updatedAt.toISOString(),
  }));
  return <div className="admin-page"><div className="dashboard-page-heading"><div><p className="dashboard-date">TIGAKAKI · ADMIN PLATFORM</p><h1><ShieldCheck size={25} /> Admin TamuKita</h1><p>Pantau operasional dan antrean yang memerlukan pemeriksaan.</p></div><div className="admin-quick-links"><Link className="button button--outline button--small" href="/admin/moderation">Moderasi konten</Link><Link className="button button--outline button--small" href="/admin/media">Media</Link><Link className="button button--outline button--small" href="/admin/orders">Order & refund</Link><Link className="button button--outline button--small" href="/admin/templates">Review template</Link><Link className="button button--outline button--small" href="/admin/settings">Pengaturan</Link></div></div><AdminOverview metrics={metrics} orders={orderRows} audit={auditRows} /><AdminOrders /><AdminWorkspaces /><AdminManagedInvitation templates={templates.map(({ slug, name, version }) => ({ slug, name, version }))} /><AdminInvitations invitations={invitationRows} /><AdminTemplateReview templates={templateRows} canSetPricing /><section className="dashboard-content-card"><div className="card-heading"><div><h2>Pengajuan reseller</h2><p>{applications.length} menunggu pemeriksaan</p></div></div><AdminResellers applications={applications} /></section></div>;
}
