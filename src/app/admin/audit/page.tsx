import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { auth } from "@/auth";
import type { Prisma } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/prisma";

export const metadata: Metadata = { title: "Audit log · Admin TamuKita" };
export const dynamic = "force-dynamic";

const pageSize = 50;
const jakartaOffsetMs = 7 * 60 * 60 * 1000;
type SearchParams = Record<string, string | string[] | undefined>;

function singleParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value.trim() : "";
}

function parseDateOnly(value: string, inclusiveEnd = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (inclusiveEnd) date.setUTCDate(date.getUTCDate() + 1);
  return new Date(date.getTime() - jakartaOffsetMs);
}

function filteredUrl(filters: { q: string; actor: string; targetType: string; from: string; to: string }, cursor?: string) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `/admin/audit?${query}` : "/admin/audit";
}

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole !== "SUPER_ADMIN") redirect("/dashboard");

  const params = await searchParams;
  const filters = {
    q: singleParam(params.q).slice(0, 100),
    actor: singleParam(params.actor).slice(0, 254),
    targetType: singleParam(params.targetType).slice(0, 80),
    from: singleParam(params.from),
    to: singleParam(params.to),
  };
  const fromDate = parseDateOnly(filters.from);
  const toDate = parseDateOnly(filters.to, true);
  const invalidDate = Boolean((filters.from && !fromDate) || (filters.to && !toDate) || (fromDate && toDate && fromDate >= toDate));

  const where: Prisma.AuditLogWhereInput = {};
  const clauses: Prisma.AuditLogWhereInput[] = [];
  if (filters.q) {
    clauses.push({ OR: [
      { action: { contains: filters.q, mode: "insensitive" } },
      { targetType: { contains: filters.q, mode: "insensitive" } },
      { targetId: { contains: filters.q, mode: "insensitive" } },
      { organization: { is: { name: { contains: filters.q, mode: "insensitive" } } } },
    ] });
  }
  if (filters.actor) clauses.push({ actor: { is: { email: { contains: filters.actor, mode: "insensitive" } } } });
  if (filters.targetType) clauses.push({ targetType: { equals: filters.targetType, mode: "insensitive" } });
  if (fromDate || toDate) {
    clauses.push({ createdAt: { ...(fromDate ? { gte: fromDate } : {}), ...(toDate ? { lt: toDate } : {}) } });
  }
  if (clauses.length) where.AND = clauses;

  let cursorClause: Prisma.AuditLogWhereInput | undefined;
  const cursorId = singleParam(params.cursor);
  if (/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(cursorId) && !invalidDate) {
    const cursor = await prisma.auditLog.findUnique({ where: { id: cursorId }, select: { id: true, createdAt: true } });
    if (cursor) cursorClause = { OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ] };
  }
  const queryWhere: Prisma.AuditLogWhereInput = cursorClause ? { AND: [where, cursorClause] } : where;
  const [entries, totalCount] = invalidDate
    ? [[], 0] as const
    : await Promise.all([
      prisma.auditLog.findMany({
        where: queryWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: pageSize + 1,
        select: {
          id: true,
          action: true,
          targetType: true,
          targetId: true,
          createdAt: true,
          actor: { select: { name: true, email: true } },
          organization: { select: { name: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

  const hasMore = entries.length > pageSize;
  const visibleEntries = entries.slice(0, pageSize);
  const nextCursor = hasMore ? visibleEntries.at(-1)?.id : undefined;
  const dateLabel = (value: Date) => new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);

  return <div className="admin-page admin-audit-page">
    <Link className="admin-back-link" href="/admin"><ArrowLeft size={15} /> Kembali ke admin</Link>
    <div className="dashboard-page-heading"><div><p className="dashboard-date">ADMIN PLATFORM · AUDIT</p><h1>Audit log</h1><p>Riwayat aktivitas administratif dan perubahan penting.</p></div></div>
    <form className="admin-audit-filters" method="get" action="/admin/audit">
      <label className="editor-field"><span className="field-label">Cari aktivitas, target, atau workspace</span><input className="text-input" name="q" maxLength={100} defaultValue={filters.q} /></label>
      <label className="editor-field"><span className="field-label">Email aktor</span><input className="text-input" name="actor" type="email" maxLength={254} defaultValue={filters.actor} /></label>
      <label className="editor-field"><span className="field-label">Jenis target</span><input className="text-input" name="targetType" maxLength={80} placeholder="Invitation, Order, User" defaultValue={filters.targetType} /></label>
      <label className="editor-field"><span className="field-label">Dari</span><input className="text-input" name="from" type="date" defaultValue={filters.from} /></label>
      <label className="editor-field"><span className="field-label">Sampai</span><input className="text-input" name="to" type="date" defaultValue={filters.to} /></label>
      <div className="admin-audit-filter-actions"><button className="button button--dark button--small" type="submit"><Search size={14} /> Terapkan</button><Link className="button button--outline button--small" href="/admin/audit">Reset</Link></div>
    </form>
    <section className="dashboard-content-card admin-audit-history-card">
      <div className="card-heading"><div><h2>Aktivitas</h2><p>{totalCount.toLocaleString("id-ID")} hasil · maksimum {pageSize} baris per halaman</p></div></div>
      {invalidDate ? <div className="editor-error" role="alert">Rentang tanggal tidak valid. Gunakan tanggal yang benar dan pastikan tanggal awal sebelum tanggal akhir.</div> : visibleEntries.length === 0 ? <div className="dashboard-empty-state"><h3>Tidak ada aktivitas yang cocok</h3><p>Ubah filter atau hapus filter untuk mencari lagi.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Waktu</th><th>Aktivitas</th><th>Target</th><th>Aktor</th><th>Workspace</th></tr></thead><tbody>
        {visibleEntries.map((entry) => <tr key={entry.id}><td>{dateLabel(entry.createdAt)}</td><td><b>{entry.action.replaceAll(".", " · ")}</b></td><td>{entry.targetType}<small>{entry.targetId ?? "—"}</small></td><td>{entry.actor?.name ?? entry.actor?.email ?? "Sistem"}{entry.actor?.name && entry.actor.email && <small>{entry.actor.email}</small>}</td><td>{entry.organization?.name ?? "Platform"}</td></tr>)}
      </tbody></table></div>}
      {!invalidDate && <nav className="admin-pagination" aria-label="Halaman audit log"><span>Menampilkan {visibleEntries.length.toLocaleString("id-ID")} aktivitas pada halaman ini</span>{nextCursor && <Link href={filteredUrl(filters, nextCursor)}>Aktivitas lebih lama <ArrowRight size={13} /></Link>}</nav>}
    </section>
  </div>;
}
