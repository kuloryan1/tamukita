import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { auth } from "@/auth";
import { AdminAnalytics } from "@/components/admin-analytics";
import { getPrismaClient } from "@/lib/prisma";

export const metadata: Metadata = { title: "Analitik TamuKita" };

const periodMs = 30 * 24 * 60 * 60 * 1000;

export default async function AdminAnalyticsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole !== "SUPER_ADMIN" && user?.platformRole !== "FINANCE") redirect("/dashboard");

  const now = new Date();
  const periodStart = new Date(now.getTime() - periodMs);
  const publicViewsStart = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth(), periodStart.getUTCDate()));
  const settledStatuses = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED", "CANCELED", "EXPIRED"] as const;
  const [newAccounts, newWorkspaces, newDrafts, completedDrafts, publishedDrafts, settledOrderCount, paidOrderCount, paidSummary, refundSummary, resellerSales, publicViews, platformViews, rsvpCount, contentReportCount, editorFeedbackCount, templateGroups, customerPayments, resellerTopUps] = await Promise.all([
    prisma.user.count({ where: { createdAt: { gte: periodStart } } }),
    prisma.organization.count({ where: { type: "PERSONAL", createdAt: { gte: periodStart } } }),
    prisma.invitation.count({ where: { deletedAt: null, createdAt: { gte: periodStart } } }),
    prisma.invitation.count({ where: { deletedAt: null, createdAt: { gte: periodStart }, formCompletedAt: { not: null } } }),
    prisma.invitation.count({ where: { deletedAt: null, createdAt: { gte: periodStart }, publishedAt: { not: null } } }),
    prisma.order.count({ where: { createdAt: { gte: periodStart }, totalAmount: { gt: 0 }, status: { in: [...settledStatuses] } } }),
    prisma.order.count({ where: { createdAt: { gte: periodStart }, totalAmount: { gt: 0 }, paidAt: { not: null } } }),
    prisma.order.aggregate({ where: { currency: "IDR", totalAmount: { gt: 0 }, paidAt: { gte: periodStart } }, _sum: { totalAmount: true } }),
    prisma.refund.aggregate({ where: { currency: "IDR", status: "SUCCEEDED", updatedAt: { gte: periodStart } }, _sum: { amount: true } }),
    prisma.resellerSale.aggregate({ where: { createdAt: { gte: periodStart }, voidedAt: null }, _sum: { amountIdr: true }, _count: { _all: true } }),
    prisma.analyticsDaily.aggregate({ where: { metricKey: "invitation_views", date: { gte: publicViewsStart } }, _sum: { metricValue: true } }),
    prisma.platformAnalyticsDaily.groupBy({
      by: ["metricKey"],
      where: { metricKey: { in: ["template_catalog_views", "template_detail_views", "template_catalog_unique_visitors"] }, date: { gte: publicViewsStart } },
      _sum: { metricValue: true },
    }),
    prisma.rSVP.count({ where: { respondedAt: { gte: periodStart }, invitation: { deletedAt: null } } }),
    prisma.contentReport.count({ where: { createdAt: { gte: periodStart } } }),
    prisma.editorFeedback.count({ where: { createdAt: { gte: periodStart } } }),
    prisma.invitation.groupBy({
      by: ["templateVersionId"],
      where: { deletedAt: null, publishedAt: { gte: periodStart } },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { currency: "IDR", totalAmount: { gt: 0 }, paidAt: { gte: periodStart }, items: { some: { itemType: { in: ["TEMPLATE_LICENSE", "ACTIVATION", "RENEWAL"] } } } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: { currency: "IDR", totalAmount: { gt: 0 }, paidAt: { gte: periodStart }, items: { some: { itemType: "RESELLER_CREDIT" } } },
      _sum: { totalAmount: true },
      _count: { _all: true },
    }),
  ]);

  const topGroups = [...templateGroups].sort((a, b) => b._count._all - a._count._all).slice(0, 5);
  const templateVersions = templateGroups.length
    ? await prisma.templateVersion.findMany({
      where: { id: { in: templateGroups.map((group) => group.templateVersionId) } },
      select: { id: true, version: true, template: { select: { name: true, slug: true, category: true } } },
    })
    : [];
  const templateById = new Map(templateVersions.map((version) => [version.id, version]));
  const topTemplates = topGroups.flatMap((group) => {
    const version = templateById.get(group.templateVersionId);
    return version ? [{ name: version.template.name, slug: version.template.slug, version: version.version, publishedCount: group._count._all }] : [];
  });
  const categoryCounts = new Map<string, number>();
  for (const group of templateGroups) {
    const category = templateById.get(group.templateVersionId)?.template.category;
    if (category) categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + group._count._all);
  }
  const templateCategories = [...categoryCounts]
    .map(([name, publishedCount]) => ({ name, publishedCount }))
    .sort((a, b) => b.publishedCount - a.publishedCount || a.name.localeCompare(b.name, "id"));
  const platformViewsByKey = new Map(platformViews.map((metric) => [metric.metricKey, metric._sum.metricValue ?? BigInt(0)]));

  const grossPayments = paidSummary._sum.totalAmount ?? 0;
  const successfulRefunds = refundSummary._sum.amount ?? 0;
  const rate = (numerator: number, denominator: number) => denominator > 0 ? `${Math.round((numerator / denominator) * 100)}%` : "—";
  const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

  return <div className="admin-page admin-analytics-page">
    <Link className="admin-back-link" href="/admin"><ArrowLeft size={15} /> Kembali ke admin</Link>
    <div className="dashboard-page-heading"><div><p className="dashboard-date">ADMIN PLATFORM · ANALITIK</p><h1><BarChart3 size={24} /> Analitik platform</h1><p>Ringkasan agregat 30 hari terakhir, tanpa rincian akun atau tamu.</p></div></div>
    <AdminAnalytics
      metrics={[
        { label: "Akun baru", value: newAccounts.toLocaleString("id-ID"), detail: "Registrasi dalam periode" },
        { label: "Workspace pelanggan baru", value: newWorkspaces.toLocaleString("id-ID"), detail: "Workspace personal dibuat" },
        { label: "Draft undangan dibuat", value: newDrafts.toLocaleString("id-ID"), detail: "Tidak termasuk yang dihapus" },
        { label: "Form editor selesai", value: completedDrafts.toLocaleString("id-ID"), detail: "Draft baru yang lolos validasi sebelum checkout atau aktivasi" },
        { label: "Penyelesaian form", value: rate(completedDrafts, newDrafts), detail: `${completedDrafts.toLocaleString("id-ID")} dari draft yang dibuat dalam kohor` },
        { label: "Konversi draft ke publikasi", value: rate(publishedDrafts, newDrafts), detail: `${publishedDrafts.toLocaleString("id-ID")} dari draft dalam kohor` },
        { label: "Konversi checkout", value: rate(paidOrderCount, settledOrderCount), detail: `${paidOrderCount.toLocaleString("id-ID")} order dibayar dari ${settledOrderCount.toLocaleString("id-ID")} order final` },
        { label: "Pengunjung marketplace harian", value: (platformViewsByKey.get("template_catalog_unique_visitors") ?? BigInt(0)).toLocaleString("id-ID"), detail: "Total hitungan harian 30 hari; browser dengan JavaScript aktif dihitung sekali per hari UTC" },
        { label: "Tampilan katalog template", value: (platformViewsByKey.get("template_catalog_views") ?? BigInt(0)).toLocaleString("id-ID"), detail: "Page view halaman marketplace, bukan pengunjung unik" },
        { label: "Tampilan detail template", value: (platformViewsByKey.get("template_detail_views") ?? BigInt(0)).toLocaleString("id-ID"), detail: "Page view halaman detail, bukan pengunjung unik" },
        { label: "Tampilan halaman undangan", value: (publicViews._sum.metricValue ?? BigInt(0)).toLocaleString("id-ID"), detail: "Page view, bukan pengunjung unik" },
        { label: "RSVP masuk", value: rsvpCount.toLocaleString("id-ID"), detail: "Respons tamu dalam periode" },
        { label: "Laporan konten", value: contentReportCount.toLocaleString("id-ID"), detail: "Laporan yang dibuat dalam periode" },
        { label: "Keluhan editor", value: editorFeedbackCount.toLocaleString("id-ID"), detail: "Laporan kendala yang dikirim dalam periode" },
        { label: "Pembayaran masuk", value: rupiah.format(grossPayments), detail: "Order IDR yang dibayar dalam periode" },
        { label: "Refund berhasil", value: rupiah.format(successfulRefunds), detail: "Refund IDR yang selesai dalam periode" },
        { label: "Penjualan reseller tercatat", value: rupiah.format(resellerSales._sum.amountIdr ?? 0), detail: `${resellerSales._count._all.toLocaleString("id-ID")} catatan, dilaporkan reseller` },
      ]}
      channels={[
        { label: "Order pelanggan: lisensi, aktivasi, renewal", count: customerPayments._count._all, amount: rupiah.format(customerPayments._sum.totalAmount ?? 0), note: "Pembayaran diterima TamuKita" },
        { label: "Top-up kredit reseller", count: resellerTopUps._count._all, amount: rupiah.format(resellerTopUps._sum.totalAmount ?? 0), note: "Pembayaran diterima TamuKita" },
        { label: "Penjualan langsung reseller", count: resellerSales._count._all, amount: rupiah.format(resellerSales._sum.amountIdr ?? 0), note: "Catatan reseller; bukan penerimaan TamuKita" },
      ]}
      templates={topTemplates}
      templateCategories={templateCategories}
      periodLabel={`${periodStart.toLocaleDateString("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" })} – ${now.toLocaleDateString("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" })}`}
    />
  </div>;
}
