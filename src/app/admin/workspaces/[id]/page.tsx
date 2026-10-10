import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, ExternalLink, Users } from "lucide-react";
import { auth } from "@/auth";
import { AdminSupportAccessButton } from "@/components/admin-support-access-button";
import { AdminWorkspaceManagement } from "@/components/admin-workspace-management";
import { getPrismaClient } from "@/lib/prisma";

export const metadata: Metadata = { title: "Detail workspace · Admin TamuKita" };

function dateLabel(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(value);
}

export default async function AdminWorkspaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") redirect("/dashboard");
  const organization = await prisma.organization.findFirst({
    where: { id, type: { not: "PLATFORM" } },
    include: {
      memberships: { orderBy: [{ role: "asc" }, { createdAt: "asc" }], include: { user: { select: { id: true, name: true, email: true, platformRole: true } } } },
      invitations: { where: { deletedAt: null }, orderBy: { updatedAt: "desc" }, take: 30, include: { owner: { select: { name: true, email: true } } } },
      resellerProfile: { select: { businessName: true, status: true, approvedAt: true } },
      auditLogs: { orderBy: { createdAt: "desc" }, take: 15, include: { actor: { select: { name: true, email: true } } } },
      _count: { select: { invitations: { where: { deletedAt: null } } } },
    },
  });
  if (!organization) notFound();
  return <div className="admin-page">
    <Link className="admin-back-link" href="/admin"><ArrowLeft size={15} /> Kembali ke admin</Link>
    <div className="dashboard-page-heading"><div><p className="dashboard-date">ADMIN PLATFORM · WORKSPACE</p><h1><Building2 size={24} /> {organization.name}</h1><p>{organization.slug} · {organization.type} · {organization.status}</p></div></div>
    <section className="admin-metric-grid admin-workspace-metrics" aria-label="Ringkasan workspace">
      <article className="admin-metric-card"><span className="admin-metric-icon"><Users size={17} /></span><span className="admin-metric-label">Anggota</span><strong>{organization.memberships.length.toLocaleString("id-ID")}</strong><small>Diperbarui {dateLabel(organization.updatedAt)}</small></article>
      <article className="admin-metric-card"><span className="admin-metric-icon"><ExternalLink size={17} /></span><span className="admin-metric-label">Undangan tersimpan</span><strong>{organization._count.invitations.toLocaleString("id-ID")}</strong><small>Menampilkan hingga 30 terbaru</small></article>
      <article className="admin-metric-card"><span className="admin-metric-icon"><Building2 size={17} /></span><span className="admin-metric-label">Reseller</span><strong>{organization.resellerProfile?.status ?? "Tidak ada"}</strong><small>{organization.resellerProfile?.businessName ?? "Workspace pelanggan"}</small></article>
    </section>
    <AdminWorkspaceManagement key={`${organization.status}:${organization.memberships.map((member) => `${member.id}-${member.role}`).join(",")}`} workspaceId={organization.id} workspaceName={organization.name} workspaceType={organization.type} workspaceStatus={organization.status} members={organization.memberships.map(({ id, userId, role, user }) => ({ id, userId, role, user }))} />
    <section className="dashboard-content-card"><div className="card-heading"><div><h2>Undangan</h2><p>Daftar 30 undangan terbaru di workspace. Akses baca untuk bantuan meminta alasan dan tercatat.</p></div></div>{organization.invitations.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Undangan</th><th>Pemilik</th><th>Status</th><th>Slug</th><th>Diperbarui</th><th></th></tr></thead><tbody>{organization.invitations.map((invitation) => <tr key={invitation.id}><td><b>{invitation.title}</b><small>{invitation.id}</small></td><td><b>{invitation.owner.name ?? "Pelanggan"}</b><small>{invitation.owner.email ?? ""}</small></td><td>{invitation.status}</td><td>{invitation.status === "PUBLISHED" ? <a href={`/${encodeURIComponent(invitation.slug)}`} target="_blank" rel="noreferrer">{invitation.slug} <ExternalLink size={12} /></a> : invitation.slug}</td><td>{dateLabel(invitation.updatedAt)}</td><td><AdminSupportAccessButton invitationId={invitation.id} /></td></tr>)}</tbody></table></div> : <div className="dashboard-empty-state"><h3>Belum ada undangan</h3></div>}</section>
    <section className="dashboard-content-card"><div className="card-heading"><div><h2>Aktivitas workspace</h2><p>Audit terbaru yang terkait dengan workspace ini.</p></div></div>{organization.auditLogs.length ? <div className="admin-audit-list">{organization.auditLogs.map((entry) => <article className="admin-audit-row" key={entry.id}><span className="admin-audit-dot" /><div><b>{entry.action.replaceAll(".", " · ")}</b><small>{entry.targetType}{entry.targetId ? ` · ${entry.targetId.slice(0, 8)}` : ""} · {entry.actor?.name ?? entry.actor?.email ?? "Sistem"}</small><small>{dateLabel(entry.createdAt)}</small></div></article>)}</div> : <div className="dashboard-empty-state"><h3>Belum ada aktivitas</h3></div>}</section>
  </div>;
}
