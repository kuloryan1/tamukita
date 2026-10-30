import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ArrowUpRight, CalendarDays, Camera, ChevronRight, Clock3, Eye, Flag, HardDrive, MessageCircle, Plus, ShieldCheck, Users } from "lucide-react";
import { auth } from "@/auth";
import { TemplateArtwork } from "@/components/template-artwork";
import { CustomerResellerRequests } from "@/components/reseller-portal";
import { HostingRenewButton } from "@/components/hosting-renew-button";
import { canRenewHosting, hostingRenewalDeadline } from "@/lib/hosting-renewal";
import { getPrismaClient } from "@/lib/prisma";
import { getTemplate, templates } from "@/lib/templates";
import { validateTemplateManifest } from "@/lib/template-sdk";
import { getInvitationFeatureAccess } from "@/lib/invitation-entitlements";

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(date);
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const prisma = getPrismaClient();
  const platformUser = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  const memberships = await prisma.membership.findMany({
    where: { userId, organization: { status: "ACTIVE" } },
    select: { organizationId: true, organization: { select: { type: true } } },
  });
  const organizationIds = memberships.map((membership) => membership.organizationId);
  const personalOrganizationIds = memberships.filter((membership) => membership.organization.type === "PERSONAL").map((membership) => membership.organizationId);
  const [invitations, analytics, resellerRequests] = await Promise.all([
    prisma.invitation.findMany({
      where: { ownerId: userId, deletedAt: null, organization: { status: "ACTIVE" } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: {
        templateVersion: { include: { template: true } },
        events: { orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true } },
        _count: { select: { rsvps: true } },
      },
    }),
    organizationIds.length
      ? prisma.analyticsDaily.aggregate({ where: { organizationId: { in: organizationIds }, metricKey: "invitation_views" }, _sum: { metricValue: true } })
      : Promise.resolve({ _sum: { metricValue: null } }),
    personalOrganizationIds.length
      ? prisma.resellerCustomer.findMany({
        where: { customerOrgId: { in: personalOrganizationIds }, status: { in: ["PENDING", "ACTIVE"] } },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true, reseller: { select: { name: true, resellerProfile: { select: { businessName: true } } } } },
      })
      : Promise.resolve([]),
  ]);
  const invitationFeatures = new Map(await Promise.all(invitations.map(async (invitation) => [invitation.id, await getInvitationFeatureAccess(invitation.id)] as const)));
  const rsvpCount = invitations.reduce((sum, invitation) => sum + invitation._count.rsvps, 0);
  const pendingResellerRequests = resellerRequests.filter((request) => request.status === "PENDING");
  const activeResellers = resellerRequests.filter((request) => request.status === "ACTIVE");
  const viewCount = Number(analytics._sum.metricValue ?? 0);
  const nextEvent = invitations.flatMap((invitation) => invitation.events.map((event) => event.startsAt))
    .filter((date) => date.getTime() >= Date.now()).sort((a, b) => a.getTime() - b.getTime())[0];
  const daysToEvent = nextEvent ? Math.ceil((nextEvent.getTime() - Date.now()) / 86_400_000) : null;
  const firstName = session.user?.name?.trim().split(/\s+/)[0] || "teman";

  return (
    <>
      <div className="dashboard-page-heading">
        <div>
          <p className="dashboard-date">{dateLabel(new Date())} · WORKSPACE</p>
          <h1>Selamat datang, {firstName} <span>✳</span></h1>
          <p>Semua undangan dan konfirmasi tamu tersimpan di ruangmu.</p>
        </div>
        <div className="dashboard-heading-actions">
          {platformUser?.platformRole === "SUPER_ADMIN" ? (
            <Link href="/admin" className="button button--outline"><ShieldCheck size={15} /> Admin platform</Link>
          ) : <>
            {platformUser?.platformRole === "CONTENT_REVIEWER" && <Link href="/admin/moderation" className="button button--outline"><Flag size={15} /> Moderasi konten</Link>}
            {platformUser?.platformRole === "SUPPORT" && <>
              <Link href="/admin/media" className="button button--outline"><HardDrive size={15} /> Media</Link>
              <Link href="/admin/editor-feedback" className="button button--outline"><MessageCircle size={15} /> Antrean bantuan</Link>
            </>}
          </>}
          <Link href="/dashboard/invitations/new/edit?new=1" className="button button--dark"><Plus size={17} /> Buat undangan baru</Link>
        </div>
      </div>
      <div className="dashboard-stat-grid"><div className="stat-card"><div className="stat-card-top"><span className="stat-icon stat-icon--rose"><Eye size={17} /></span><span className="stat-period">Akumulasi</span></div><strong>{viewCount.toLocaleString("id-ID")}</strong><span className="stat-label">Total kunjungan undangan</span><div className="stat-foot"><span>Dihitung dari halaman publikasi.</span></div></div><div className="stat-card"><div className="stat-card-top"><span className="stat-icon stat-icon--sage"><Users size={17} /></span><span className="stat-period">Jumlah RSVP</span></div><strong>{rsvpCount.toLocaleString("id-ID")}</strong><span className="stat-label">Konfirmasi kehadiran</span><div className="stat-foot"><span>Respons tamu yang tercatat.</span></div></div><div className="stat-card stat-card--soft"><div className="stat-card-top"><span className="stat-icon stat-icon--gold"><CalendarDays size={17} /></span><span className="stat-period">Acara terdekat</span></div><strong>{daysToEvent === null ? "—" : daysToEvent.toLocaleString("id-ID")}</strong><span className="stat-label">{daysToEvent === null ? "Belum ada jadwal acara" : "Hari menuju acara"}</span><div className="stat-foot"><span>{nextEvent ? dateLabel(nextEvent) : "Tambahkan tanggal pada draft undangan."}</span></div></div></div>
      <CustomerResellerRequests
        requests={pendingResellerRequests.map((request) => ({ id: request.id, resellerName: request.reseller.resellerProfile?.businessName ?? request.reseller.name }))}
        activeResellers={activeResellers.map((request) => ({ id: request.id, resellerName: request.reseller.resellerProfile?.businessName ?? request.reseller.name }))}
      />
      <section id="invitations" className="dashboard-content-card" tabIndex={-1}><div className="card-heading"><div><h2>Undangan saya</h2><p>Kelola draft dan halaman undanganmu.</p></div><Link href="/dashboard/invitations/new/edit?new=1" className="text-link">Buat undangan <ChevronRight size={16} /></Link></div>
        {invitations.length === 0 ? <div className="dashboard-empty-state"><span className="draft-thumb"><span>✳</span></span><h3>Ruang ceritamu masih kosong</h3><p>Buat draft pertama, lengkapi detail acara, lalu simpan. Publikasi baru aktif setelah pembayaran berhasil dikonfirmasi.</p><Link href="/dashboard/invitations/new/edit?new=1" className="button button--dark"><Plus size={16} /> Mulai buat undangan</Link></div> : invitations.map((invitation) => {
          const manifest = validateTemplateManifest(invitation.templateVersion.manifest);
          const template = manifest.success
            && manifest.data.slug === invitation.templateVersion.template.slug
            && manifest.data.version === invitation.templateVersion.version
            ? manifest.data
            : getTemplate(invitation.templateVersion.template.slug) ?? templates[0];
          const isExpired = invitation.status === "EXPIRED" || Boolean(invitation.expiresAt && invitation.expiresAt.getTime() <= Date.now());
          const isPublished = invitation.status === "PUBLISHED" && !isExpired;
          const canRenew = Boolean(invitation.expiresAt && canRenewHosting(invitation.expiresAt));
          const hasRsvp = invitationFeatures.get(invitation.id)?.rsvp ?? true;
          const editHref = `/dashboard/invitations/${encodeURIComponent(invitation.id)}/edit`;
          const eventDate = invitation.events[0]?.startsAt;
          return <div className={`invitation-row${isPublished ? "" : " invitation-row--draft"}`} key={invitation.id}><div className="invitation-thumb"><TemplateArtwork template={template} /></div><div className="invitation-row-main"><div className="invitation-title-row"><h3>{invitation.title}</h3><span className={`status-pill ${isPublished ? "status-pill--live" : "status-pill--draft"}`}><i />{isExpired ? "Hosting berakhir" : isPublished ? "Aktif" : invitation.status === "PUBLISHED" ? "Ditangguhkan" : invitation.status}</span></div><p><span>{isPublished ? `tamukita.io/${invitation.slug}` : "Belum diterbitkan"}</span><span className="row-divider">·</span> {invitation.templateVersion.template.name}</p><div className="invitation-row-meta">{hasRsvp && <span><Users size={13} /> {invitation._count.rsvps} RSVP</span>}<span><Clock3 size={13} /> Diubah {dateLabel(invitation.updatedAt)}</span>{eventDate && <span><CalendarDays size={13} /> Acara {dateLabel(eventDate)}</span>}{invitation.expiresAt && <span><CalendarDays size={13} /> Hosting sampai {dateLabel(invitation.expiresAt)}</span>}</div></div><div className="invitation-row-actions">{isPublished && <><Link href={editHref} className="button button--outline button--small">Edit</Link>{hasRsvp && <Link href={`/dashboard/invitations/${invitation.id}/guests`} className="button button--outline button--small"><Users size={14} /> Tamu</Link>}<Link href={`/dashboard/invitations/${invitation.id}/guestbook`} className="button button--outline button--small"><MessageCircle size={14} /> Ucapan</Link></>}{isPublished ? <Link href={`/${invitation.slug}`} className="button button--outline button--small">Lihat undangan <ArrowUpRight size={14} /></Link> : invitation.status === "PUBLISHED" || invitation.status === "EXPIRED" ? <Link href={editHref} className="button button--outline button--small">Edit undangan <ArrowRight size={14} /></Link> : <Link href={editHref} className="button button--outline button--small">Lanjutkan <ArrowRight size={14} /></Link>}<Link href={`/dashboard/invitations/${invitation.id}/paparazi`} className="button button--outline button--small"><Camera size={14} /> Paparazi</Link>{canRenew && ["PUBLISHED", "EXPIRED"].includes(invitation.status) && <HostingRenewButton invitationId={invitation.id} />}{isExpired && invitation.expiresAt && ["PUBLISHED", "EXPIRED"].includes(invitation.status) && !canRenew && <small className="hosting-renew-expired">Batas perpanjangan {dateLabel(hostingRenewalDeadline(invitation.expiresAt))}</small>}</div></div>;
        })}
      </section>
    </>
  );
}
