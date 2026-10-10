import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { AdminSupportAccessRevoke } from "@/components/admin-support-access-revoke";
import { getPrismaClient } from "@/lib/prisma";
import { isR2PublicUrl } from "@/lib/r2";

export const metadata: Metadata = { title: "Akses bantuan baca saja · Admin TamuKita" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function displayValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value) || "—";
  if (value === null || value === undefined) return "—";
  return JSON.stringify(value);
}

const fieldLabels: Record<string, string> = {
  eventKind: "Jenis acara", eventTitle: "Judul acara", hostOne: "Nama pertama", hostTwo: "Nama kedua", familyDetails: "Keluarga / penyelenggara",
  eventDate: "Tanggal", eventTime: "Waktu", venue: "Tempat", address: "Alamat", mapsUrl: "Tautan peta",
  story: "Cerita", slug: "Slug", templateId: "Template", templateVersion: "Versi template",
  coverPhoto: "Foto sampul", coverPosition: "Posisi foto vertikal", coverPositionX: "Posisi foto horizontal", galleryPhotos: "Foto galeri",
  giftMessage: "Pesan hadiah", giftBankName: "Bank", giftAccountName: "Nama pemilik rekening",
  giftAccountNumber: "Nomor rekening", musicTitle: "Judul musik",
};

export default async function AdminSupportAccessPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") redirect("/dashboard");
  const now = new Date();
  const grant = await prisma.$transaction(async (tx) => {
    const current = await tx.supportAccessGrant.findFirst({
      where: { id, adminId: userId, revokedAt: null, expiresAt: { gt: now }, invitation: { deletedAt: null }, organization: { type: { not: "PLATFORM" } } },
      include: {
        organization: { select: { name: true } },
        invitation: { select: { id: true, title: true, slug: true, status: true, updatedAt: true, draftData: true, owner: { select: { name: true, email: true } } } },
      },
    });
    if (!current) return null;
    const opened = await tx.supportAccessGrant.updateMany({ where: { id, adminId: userId, revokedAt: null, expiresAt: { gt: now } }, data: { lastAccessedAt: now } });
    if (opened.count !== 1) return null;
    await tx.auditLog.create({
      data: { organizationId: current.organizationId, actorId: userId, action: "admin.support_access_viewed", targetType: "SupportAccessGrant", targetId: current.id, metadata: { invitationId: current.invitationId, reason: current.reason, expiresAt: current.expiresAt.toISOString() } },
    });
    return current;
  });
  if (!grant) notFound();
  const draft = isRecord(grant.invitation.draftData) ? grant.invitation.draftData : {};
  const fields = Object.entries(fieldLabels).filter(([key]) => Object.hasOwn(draft, key));
  return <div className="admin-page">
    <Link className="admin-back-link" href={`/admin/workspaces/${grant.organizationId}`}><ArrowLeft size={15} /> Kembali ke workspace</Link>
    <div className="dashboard-page-heading"><div><p className="dashboard-date">AKSES BANTUAN · BACA SAJA · BERAKHIR {new Intl.DateTimeFormat("id-ID", { timeStyle: "short", timeZone: "Asia/Jakarta" }).format(grant.expiresAt)}</p><h1><ShieldCheck size={24} /> {grant.invitation.title}</h1><p>{grant.organization.name} · {grant.invitation.owner.name ?? "Pelanggan"} · {grant.invitation.owner.email ?? "Email tidak tersedia"}</p></div></div>
    <section className="support-access-banner"><ShieldCheck size={17} /><div><b>Akses bantuan aktif dan dicatat</b><span>Alasan: {grant.reason}</span><span>Berakhir: {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(grant.expiresAt)}</span></div></section>
    <section className="dashboard-content-card support-access-content"><div className="card-heading"><div><h2>Data undangan</h2><p>Informasi berikut hanya dapat dilihat selama izin masih aktif.</p></div><span className={`status-pill ${grant.invitation.status === "PUBLISHED" ? "status-pill--live" : "status-pill--draft"}`}><i />{grant.invitation.status}</span></div>
      <div className="support-access-fields">{fields.map(([key, label]) => {
        const value = draft[key];
        if (key === "coverPhoto" && typeof value === "string" && isR2PublicUrl(value)) return <div className="support-access-field support-access-field--wide" key={key}><b>{label}</b><a href={value} target="_blank" rel="noreferrer">Buka foto sampul</a></div>;
        if (key === "galleryPhotos" && Array.isArray(value)) return <div className="support-access-field support-access-field--wide" key={key}><b>{label}</b><span>{value.filter((item): item is string => typeof item === "string" && isR2PublicUrl(item)).map((url, index) => <a href={url} target="_blank" rel="noreferrer" key={url}>Foto {index + 1}</a>)}</span></div>;
        const mapsUrl = typeof value === "string" ? (() => { try { const parsed = new URL(value); return parsed.protocol === "https:" ? parsed.toString() : ""; } catch { return ""; } })() : "";
        return <div className={`support-access-field${["story", "address", "giftMessage", "giftAccountNumber"].includes(key) ? " support-access-field--wide" : ""}`} key={key}><b>{label}</b>{key === "mapsUrl" && mapsUrl ? <a href={mapsUrl} target="_blank" rel="noreferrer">Buka tautan peta</a> : <span>{displayValue(value)}</span>}</div>;
      })}</div>
      <div className="support-access-actions"><span>Terakhir diperbarui: {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(grant.invitation.updatedAt)}</span><AdminSupportAccessRevoke grantId={grant.id} /></div>
    </section>
  </div>;
}
