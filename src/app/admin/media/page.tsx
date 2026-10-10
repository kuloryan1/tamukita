import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HardDrive, ImageOff, LoaderCircle } from "lucide-react";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";

export const metadata: Metadata = { title: "Penyimpanan media" };

function formatBytes(value: bigint) {
  const bytes = Number(value);
  if (bytes < 1_000) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = bytes / 1_000;
  let unitIndex = 0;
  while (amount >= 1_000 && unitIndex < units.length - 1) {
    amount /= 1_000;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(amount)} ${units[unitIndex]}`;
}

const statusLabels = {
  PENDING: "Menunggu diproses",
  PROCESSING: "Sedang diproses",
  READY: "Siap",
  FAILED: "Gagal",
  DELETED: "Dihapus",
} as const;

export default async function AdminMediaPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole !== "SUPER_ADMIN" && user?.platformRole !== "SUPPORT") redirect("/dashboard");

  const [assetSummary, variantSummary, statuses, problemAssets] = await Promise.all([
    prisma.mediaAsset.aggregate({ where: { deletedAt: null, status: { not: "DELETED" } }, _count: { _all: true }, _sum: { sizeBytes: true } }),
    prisma.mediaVariant.aggregate({ where: { mediaAsset: { deletedAt: null, status: { not: "DELETED" } } }, _count: { _all: true }, _sum: { sizeBytes: true } }),
    prisma.mediaAsset.groupBy({ by: ["status"], where: { deletedAt: null, status: { not: "DELETED" } }, _count: { _all: true } }),
    prisma.mediaAsset.findMany({
      where: { deletedAt: null, status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        status: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        organization: { select: { name: true } },
        invitation: { select: { title: true } },
      },
    }),
  ]);
  const statusCount = new Map(statuses.map((item) => [item.status, item._count._all]));
  const sourceBytes = assetSummary._sum.sizeBytes ?? BigInt(0);
  const variantBytes = variantSummary._sum.sizeBytes ?? BigInt(0);
  const totalBytes = sourceBytes + variantBytes;

  return <section className="admin-media-page">
    <Link href={user.platformRole === "SUPER_ADMIN" ? "/admin" : "/dashboard"} className="back-link"><ArrowLeft size={15} /> Kembali</Link>
    <div className="dashboard-page-heading"><div><p className="dashboard-date">TIGAKAKI · OPERASIONAL</p><h1><HardDrive size={25} /> Penyimpanan media</h1><p>Ringkasan media yang tercatat di database dan file yang perlu perhatian.</p></div></div>
    <div className="admin-media-metrics">
      <article className="admin-metric-card"><span className="admin-metric-icon"><HardDrive size={17} /></span><span className="admin-metric-label">Perkiraan tersimpan</span><strong>{formatBytes(totalBytes)}</strong><small>Original {formatBytes(sourceBytes)} · varian {formatBytes(variantBytes)}</small></article>
      <article className="admin-metric-card"><span className="admin-metric-icon"><ImageOff size={17} /></span><span className="admin-metric-label">Media gagal</span><strong>{(statusCount.get("FAILED") ?? 0).toLocaleString("id-ID")}</strong><small>Unggahan yang gagal diproses</small></article>
      <article className="admin-metric-card"><span className="admin-metric-icon"><LoaderCircle size={17} /></span><span className="admin-metric-label">Belum selesai</span><strong>{((statusCount.get("PENDING") ?? 0) + (statusCount.get("PROCESSING") ?? 0)).toLocaleString("id-ID")}</strong><small>Menunggu atau sedang diproses</small></article>
      <article className="admin-metric-card"><span className="admin-metric-icon"><ImageOff size={17} /></span><span className="admin-metric-label">File sumber</span><strong>{assetSummary._count._all.toLocaleString("id-ID")}</strong><small>{variantSummary._count._all.toLocaleString("id-ID")} varian optimasi tercatat</small></article>
    </div>
    <p className="admin-media-note">Angka ini dihitung dari ukuran file yang tercatat di PostgreSQL (original dan varian), bukan tagihan Cloudflare R2. Objek R2 yang tidak memiliki record database tidak termasuk.</p>
    <section className="dashboard-content-card admin-media-queue"><div className="card-heading"><div><h2>File yang perlu perhatian</h2><p>Unggahan terbaru yang masih menunggu, sedang diproses, atau gagal.</p></div></div>
      {problemAssets.length === 0 ? <div className="dashboard-empty-state"><HardDrive size={22} /><h3>Tidak ada file tertunda</h3><p>Unggahan yang belum selesai akan muncul di sini.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Jenis file</th><th>Workspace</th><th>Undangan</th><th>Ukuran</th><th>Status</th><th>Dikirim</th></tr></thead><tbody>{problemAssets.map((asset) => <tr key={asset.id}><td><b>{asset.mimeType}</b><small>{asset.id.slice(0, 8)}</small></td><td>{asset.organization.name}</td><td>{asset.invitation?.title ?? "—"}</td><td>{formatBytes(asset.sizeBytes)}</td><td><span className={`status-pill ${asset.status === "FAILED" ? "status-pill--draft" : "status-pill--live"}`}><i />{statusLabels[asset.status]}</span></td><td>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(asset.createdAt)}</td></tr>)}</tbody></table></div>}
    </section>
  </section>;
}
