import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { CalendarDays, Eye, Flag, HardDrive, MessageCircle, Plus, ShieldCheck, Users } from "lucide-react";
import { auth } from "@/auth";
import { DashboardInvitations, dashboardInvitationsHref, type InvitationFilter } from "@/components/dashboard-invitations";
import { CustomerResellerRequests } from "@/components/reseller-portal";
import { canRenewHosting, hostingRenewalDeadline } from "@/lib/hosting-renewal";
import { getPrismaClient } from "@/lib/prisma";
import { getTemplate, templates } from "@/lib/templates";
import { validateTemplateManifest } from "@/lib/template-sdk";
import { getInvitationFeatureAccess } from "@/lib/invitation-entitlements";

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(date);
}

const PAGE_SIZE = 12;
const invitationFilters: InvitationFilter[] = ["all", "draft", "published", "expired", "suspended", "archived"];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; status?: string | string[]; page?: string | string[] }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const params = await searchParams;
  const firstValue = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const query = (firstValue(params.q) ?? "").trim().slice(0, 100);
  const requestedStatus = firstValue(params.status);
  const status = invitationFilters.find((filter) => filter === requestedStatus) ?? "all";
  const parsedPage = Number(firstValue(params.page) ?? "1");
  const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? Math.min(parsedPage, 10_000) : 1;
  const now = new Date();
  const ownerScope: Prisma.InvitationWhereInput = { ownerId: userId, deletedAt: null, organization: { status: "ACTIVE" } };
  const statusScope: Prisma.InvitationWhereInput = status === "draft" ? { status: "DRAFT" }
    : status === "published" ? { status: "PUBLISHED", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }
      : status === "expired" ? { OR: [{ status: "EXPIRED" }, { status: "PUBLISHED", expiresAt: { lte: now } }] }
        : status === "suspended" ? { status: "SUSPENDED" }
          : status === "archived" ? { status: "ARCHIVED" } : {};
  const searchScope: Prisma.InvitationWhereInput = query ? { OR: [
    { title: { contains: query, mode: "insensitive" } },
    { slug: { contains: query, mode: "insensitive" } },
    { templateVersion: { template: { name: { contains: query, mode: "insensitive" } } } },
  ] } : {};
  const filteredScope: Prisma.InvitationWhereInput = { AND: [ownerScope, statusScope, searchScope] };
  const prisma = getPrismaClient();
  const platformUser = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  const memberships = await prisma.membership.findMany({
    where: { userId, organization: { status: "ACTIVE" } },
    select: { organizationId: true, organization: { select: { type: true } } },
  });
  const organizationIds = memberships.map((membership) => membership.organizationId);
  const personalOrganizationIds = memberships.filter((membership) => membership.organization.type === "PERSONAL").map((membership) => membership.organizationId);
  const [invitations, recentInvitations, totalCount, filteredCount, analytics, resellerRequests] = await Promise.all([
    prisma.invitation.findMany({
      where: filteredScope,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        templateVersion: { include: { template: true } },
        events: { orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true } },
        _count: { select: { rsvps: true } },
      },
    }),
    // Summary cards remain independent of list filters and pagination.
    prisma.invitation.findMany({
      where: ownerScope,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 6,
      select: { events: { orderBy: { startsAt: "asc" }, take: 1, select: { startsAt: true } }, _count: { select: { rsvps: true } } },
    }),
    prisma.invitation.count({ where: ownerScope }),
    prisma.invitation.count({ where: filteredScope }),
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
  const lastPage = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));
  if (page > lastPage) redirect(dashboardInvitationsHref({ query, status, page: lastPage }));
  const invitationFeatures = new Map(await Promise.all(invitations.map(async (invitation) => [invitation.id, await getInvitationFeatureAccess(invitation.id)] as const)));
  const rsvpCount = recentInvitations.reduce((sum, invitation) => sum + invitation._count.rsvps, 0);
  const pendingResellerRequests = resellerRequests.filter((request) => request.status === "PENDING");
  const activeResellers = resellerRequests.filter((request) => request.status === "ACTIVE");
  const viewCount = Number(analytics._sum.metricValue ?? 0);
  const nextEvent = recentInvitations.flatMap((invitation) => invitation.events.map((event) => event.startsAt))
    .filter((date) => date.getTime() >= now.getTime()).sort((a, b) => a.getTime() - b.getTime())[0];
  const daysToEvent = nextEvent ? Math.ceil((nextEvent.getTime() - now.getTime()) / 86_400_000) : null;
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
      <div className="dashboard-stat-grid"><div className="stat-card"><div className="stat-card-top"><span className="stat-icon stat-icon--rose"><Eye size={17} /></span><span className="stat-period">Akumulasi</span></div><strong>{viewCount.toLocaleString("id-ID")}</strong><span className="stat-label">Total kunjungan undangan</span><div className="stat-foot"><span>Dihitung dari halaman publikasi.</span></div></div><div className="stat-card"><div className="stat-card-top"><span className="stat-icon stat-icon--sage"><Users size={17} /></span><span className="stat-period">Jumlah konfirmasi</span></div><strong>{rsvpCount.toLocaleString("id-ID")}</strong><span className="stat-label">Konfirmasi kehadiran</span><div className="stat-foot"><span>Dari enam undangan terbaru.</span></div></div><div className="stat-card stat-card--soft"><div className="stat-card-top"><span className="stat-icon stat-icon--gold"><CalendarDays size={17} /></span><span className="stat-period">Undangan terbaru</span></div><strong>{daysToEvent === null ? "—" : daysToEvent.toLocaleString("id-ID")}</strong><span className="stat-label">{daysToEvent === null ? "Belum ada jadwal acara" : "Hari menuju acara"}</span><div className="stat-foot"><span>{nextEvent ? dateLabel(nextEvent) : "Tambahkan tanggal pada draft undangan."}</span></div></div></div>
      <CustomerResellerRequests
        requests={pendingResellerRequests.map((request) => ({ id: request.id, resellerName: request.reseller.resellerProfile?.businessName ?? request.reseller.name }))}
        activeResellers={activeResellers.map((request) => ({ id: request.id, resellerName: request.reseller.resellerProfile?.businessName ?? request.reseller.name }))}
      />
      <DashboardInvitations
        query={query}
        status={status}
        page={page}
        pageSize={PAGE_SIZE}
        totalCount={totalCount}
        filteredCount={filteredCount}
        invitations={invitations.map((invitation) => {
          const manifest = validateTemplateManifest(invitation.templateVersion.manifest);
          const template = manifest.success
            && manifest.data.slug === invitation.templateVersion.template.slug
            && manifest.data.version === invitation.templateVersion.version
            ? manifest.data
            : getTemplate(invitation.templateVersion.template.slug) ?? templates[0];
          const isExpired = invitation.status === "EXPIRED" || (invitation.status === "PUBLISHED" && Boolean(invitation.expiresAt && invitation.expiresAt.getTime() <= now.getTime()));
          return {
            id: invitation.id,
            title: invitation.title,
            slug: invitation.slug,
            status: invitation.status,
            template,
            updatedAt: invitation.updatedAt,
            eventDate: invitation.events[0]?.startsAt ?? null,
            expiresAt: invitation.expiresAt,
            isExpired,
            isPublished: invitation.status === "PUBLISHED" && !isExpired,
            canRenew: Boolean(invitation.expiresAt && canRenewHosting(invitation.expiresAt)),
            renewalDeadline: invitation.expiresAt ? hostingRenewalDeadline(invitation.expiresAt) : null,
            hasRsvp: invitationFeatures.get(invitation.id)?.rsvp ?? true,
            rsvpCount: invitation._count.rsvps,
          };
        })}
      />
    </>
  );
}
