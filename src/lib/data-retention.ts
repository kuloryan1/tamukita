import type { Prisma, PrismaClient } from "@/generated/prisma/client";

export const DATA_RETENTION_BATCH_SIZE = 100;
export const GUEST_DATA_AFTER_EVENT_DAYS = 90;
export const DATA_AFTER_HOSTING_DAYS = 30;

export type InvitationRetentionDates = {
  startsAt: Date | null;
  expiresAt: Date | null;
  deletedAt: Date | null;
  events: Array<{ startsAt: Date }>;
};

export type DataRetentionReport = {
  invitationsScanned: number;
  invitationGuestDataGroupsPurged: number;
  rsvpsPurged: number;
  guestbookEntriesPurged: number;
  guestLinksPurged: number;
  guestsPurged: number;
  mediaAssetsPurged: number;
  mediaAssetsDeferred: number;
  mediaAssetFailures: number;
  accountTokensPurged: number;
  sessionsPurged: number;
  verificationTokensPurged: number;
  notificationJobsPurged: number;
  contentReportsPurged: number;
  editorFeedbackPurged: number;
  supportAccessGrantsPurged: number;
  auditLogsPurged: number;
  rateLimitBucketsPurged: number;
  analyticsDailyPurged: number;
  platformAnalyticsDailyPurged: number;
};

export type DataRetentionOptions = {
  now?: Date;
  privateBucket?: string;
  publicBucket?: string;
  deleteObject?: (bucket: string, key: string) => Promise<void>;
};

function addUtcDays(value: Date, days: number) {
  const result = new Date(value.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function subtractUtcMonths(value: Date, months: number) {
  const result = new Date(value);
  result.setUTCMonth(result.getUTCMonth() - months);
  return result;
}

function latestDate(values: Array<Date | null | undefined>) {
  const dates = values.filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()));
  if (dates.length === 0) return null;
  return new Date(Math.max(...dates.map((value) => value.getTime())));
}

function earliestDate(values: Array<Date | null | undefined>) {
  const dates = values.filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()));
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((value) => value.getTime())));
}

export function guestDataRetentionDeadline(invitation: InvitationRetentionDates) {
  const hostingEnd = earliestDate([invitation.expiresAt, invitation.deletedAt]);
  if (!hostingEnd) return null;

  const hostingDeadline = addUtcDays(hostingEnd, DATA_AFTER_HOSTING_DAYS);
  const eventDates = [invitation.startsAt, ...invitation.events.map((event) => event.startsAt)]
    .filter((eventDate): eventDate is Date => eventDate instanceof Date && eventDate <= hostingEnd);
  const lastEvent = latestDate(eventDates);
  const eventDeadline = lastEvent ? addUtcDays(lastEvent, GUEST_DATA_AFTER_EVENT_DAYS) : hostingDeadline;
  return latestDate([hostingDeadline, eventDeadline]);
}

export function mediaRetentionDeadline(expiresAt: Date | null, deletedAt: Date | null) {
  const hostingEnd = earliestDate([expiresAt, deletedAt]);
  return hostingEnd ? addUtcDays(hostingEnd, DATA_AFTER_HOSTING_DAYS) : null;
}

function emptyReport(): DataRetentionReport {
  return {
    invitationsScanned: 0,
    invitationGuestDataGroupsPurged: 0,
    rsvpsPurged: 0,
    guestbookEntriesPurged: 0,
    guestLinksPurged: 0,
    guestsPurged: 0,
    mediaAssetsPurged: 0,
    mediaAssetsDeferred: 0,
    mediaAssetFailures: 0,
    accountTokensPurged: 0,
    sessionsPurged: 0,
    verificationTokensPurged: 0,
    notificationJobsPurged: 0,
    contentReportsPurged: 0,
    editorFeedbackPurged: 0,
    supportAccessGrantsPurged: 0,
    auditLogsPurged: 0,
    rateLimitBucketsPurged: 0,
    analyticsDailyPurged: 0,
    platformAnalyticsDailyPurged: 0,
  };
}

async function purgeInvitationGuestData(prisma: PrismaClient, invitationId: string, now: Date, reportRetentionCutoff: Date) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "invitations" WHERE id = ${invitationId}::uuid FOR UPDATE`;
    const invitation = await tx.invitation.findUnique({
      where: { id: invitationId },
      select: {
        startsAt: true,
        expiresAt: true,
        deletedAt: true,
        events: { select: { startsAt: true } },
        orders: { where: { status: "PENDING" }, select: { id: true }, take: 1 },
      },
    });
    const deadline = invitation ? guestDataRetentionDeadline(invitation) : null;
    if (!invitation || invitation.orders.length > 0 || !deadline || deadline > now) {
      return { rsvps: 0, guestbookEntries: 0, guestLinks: 0, guests: 0, purged: false };
    }

    const [rsvps, guestbookEntries, guestLinks, heldGuestbookEntries] = await Promise.all([
      tx.rSVP.findMany({ where: { invitationId }, select: { guestId: true } }),
      tx.guestbookEntry.findMany({ where: { invitationId }, select: { guestId: true } }),
      tx.guestLink.findMany({ where: { invitationId }, select: { guestId: true } }),
      tx.guestbookEntry.findMany({
        where: {
          invitationId,
          reports: { some: { OR: [{ status: "PENDING" }, { reviewedAt: null }, { reviewedAt: { gt: reportRetentionCutoff } }] } },
        },
        select: { id: true },
      }),
    ]);
    const guestIds = [...new Set([...rsvps, ...guestbookEntries, ...guestLinks].flatMap((row) => row.guestId ? [row.guestId] : []))];

    const deletedRsvps = await tx.rSVP.deleteMany({ where: { invitationId } });
    const deletedGuestbookEntries = await tx.guestbookEntry.deleteMany({
      where: { invitationId, ...(heldGuestbookEntries.length > 0 ? { id: { notIn: heldGuestbookEntries.map((entry) => entry.id) } } : {}) },
    });
    const deletedGuestLinks = await tx.guestLink.deleteMany({ where: { invitationId } });
    const orphanedGuests = guestIds.length === 0 ? [] : await tx.guest.findMany({
      where: {
        id: { in: guestIds },
        links: { none: {} },
        rsvps: { none: {} },
        guestbookEntries: { none: {} },
      },
      select: { id: true },
    });
    const deletedGuests = orphanedGuests.length === 0
      ? { count: 0 }
      : await tx.guest.deleteMany({ where: { id: { in: orphanedGuests.map((guest) => guest.id) } } });

    return {
      rsvps: deletedRsvps.count,
      guestbookEntries: deletedGuestbookEntries.count,
      guestLinks: deletedGuestLinks.count,
      guests: deletedGuests.count,
      purged: true,
    };
  });
}

async function purgeExpiredMedia(
  prisma: PrismaClient,
  now: Date,
  options: DataRetentionOptions,
  report: DataRetentionReport,
) {
  const mediaCutoff = addUtcDays(now, -DATA_AFTER_HOSTING_DAYS);
  const { deleteObject, privateBucket, publicBucket } = options;
  const where: Prisma.MediaAssetWhereInput = {
    AND: [
      {
        OR: [
          { deletedAt: { lte: mediaCutoff } },
          { invitation: { is: { expiresAt: { lte: mediaCutoff } } } },
          { invitation: { is: { deletedAt: { lte: mediaCutoff } } } },
        ],
      },
      {
        OR: [
          { invitationId: null },
          { invitation: { is: { orders: { none: { status: "PENDING" } } } } },
        ],
      },
    ],
  };
  if (!deleteObject || !privateBucket || !publicBucket) {
    report.mediaAssetsDeferred = await prisma.mediaAsset.count({ where });
    return;
  }

  let lastId: string | null = null;
  while (true) {
    const cursor: Prisma.MediaAssetWhereInput = lastId ? { id: { gt: lastId } } : {};
    const assets = await prisma.mediaAsset.findMany({
      where: { AND: [where, cursor] },
      orderBy: { id: "asc" },
      take: DATA_RETENTION_BATCH_SIZE,
      select: { id: true, invitationId: true, storageKey: true, variants: { select: { storageKey: true } } },
    });
    if (assets.length === 0) break;
    lastId = assets[assets.length - 1].id;

    for (const asset of assets) {
      try {
        const deleted = await prisma.$transaction(async (tx) => {
          if (asset.invitationId) {
            await tx.$queryRaw`SELECT id FROM "invitations" WHERE id = ${asset.invitationId}::uuid FOR UPDATE`;
          } else {
            await tx.$queryRaw`SELECT id FROM "media_assets" WHERE id = ${asset.id}::uuid FOR UPDATE`;
          }
          const current = await tx.mediaAsset.findFirst({ where: { id: asset.id, AND: [where] }, select: { id: true } });
          if (!current) return false;

          const keys = [...new Set([asset.storageKey, ...asset.variants.map((variant) => variant.storageKey)])];
          for (const key of keys) {
            await deleteObject(privateBucket, key);
            await deleteObject(publicBucket, key);
          }
          const result = await tx.mediaAsset.deleteMany({ where: { id: asset.id } });
          return result.count > 0;
        });
        if (deleted) report.mediaAssetsPurged += 1;
      } catch {
        report.mediaAssetFailures += 1;
      }
    }
    if (assets.length < DATA_RETENTION_BATCH_SIZE) break;
  }
}

export async function runDataRetentionSweep(
  prisma: PrismaClient,
  options: DataRetentionOptions = {},
): Promise<DataRetentionReport> {
  const now = options.now ?? new Date();
  const auditCutoff = subtractUtcMonths(now, 12);
  const jobCutoff = addUtcDays(now, -90);
  const rateLimitCutoff = addUtcDays(now, -1);
  const guestDataHostingCutoff = addUtcDays(now, -DATA_AFTER_HOSTING_DAYS);
  const guestDataEventCutoff = addUtcDays(now, -GUEST_DATA_AFTER_EVENT_DAYS);
  const report = emptyReport();
  const staleInvitationWhere: Prisma.InvitationWhereInput = {
    AND: [
      { OR: [{ expiresAt: { lte: guestDataHostingCutoff } }, { deletedAt: { lte: guestDataHostingCutoff } }] },
      { OR: [{ startsAt: null }, { startsAt: { lte: guestDataEventCutoff } }] },
      { events: { none: { startsAt: { gt: guestDataEventCutoff } } } },
      { orders: { none: { status: "PENDING" } } },
      {
        OR: [
          { rsvps: { some: {} } },
          { guestLinks: { some: {} } },
          {
            guestbook: {
              some: {
                reports: { none: { OR: [{ status: "PENDING" }, { reviewedAt: null }, { reviewedAt: { gt: auditCutoff } }] } },
              },
            },
          },
        ],
      },
    ],
  };

  let lastInvitationId: string | null = null;
  while (true) {
    const cursor: Prisma.InvitationWhereInput = lastInvitationId ? { id: { gt: lastInvitationId } } : {};
    const invitations = await prisma.invitation.findMany({
      where: { AND: [staleInvitationWhere, cursor] },
      orderBy: { id: "asc" },
      take: DATA_RETENTION_BATCH_SIZE,
      select: { id: true, startsAt: true, expiresAt: true, deletedAt: true, events: { select: { startsAt: true } } },
    });
    if (invitations.length === 0) break;
    lastInvitationId = invitations[invitations.length - 1].id;
    report.invitationsScanned += invitations.length;

    for (const invitation of invitations) {
      const deadline = guestDataRetentionDeadline(invitation);
      if (!deadline || deadline > now) continue;
      const result = await purgeInvitationGuestData(prisma, invitation.id, now, auditCutoff);
      if (!result.purged) continue;
      report.invitationGuestDataGroupsPurged += 1;
      report.rsvpsPurged += result.rsvps;
      report.guestbookEntriesPurged += result.guestbookEntries;
      report.guestLinksPurged += result.guestLinks;
      report.guestsPurged += result.guests;
    }
    if (invitations.length < DATA_RETENTION_BATCH_SIZE) break;
  }

  await purgeExpiredMedia(prisma, now, options, report);
  report.accountTokensPurged = (await prisma.accountToken.deleteMany({ where: { expiresAt: { lte: now } } })).count;
  report.sessionsPurged = (await prisma.session.deleteMany({ where: { expires: { lte: now } } })).count;
  report.verificationTokensPurged = (await prisma.verificationToken.deleteMany({ where: { expires: { lte: now } } })).count;
  report.notificationJobsPurged = (await prisma.notificationJob.deleteMany({ where: { OR: [{ completedAt: { lte: jobCutoff } }, { failedAt: { lte: jobCutoff } }] } })).count;
  report.contentReportsPurged = (await prisma.contentReport.deleteMany({ where: { status: { not: "PENDING" }, reviewedAt: { lte: auditCutoff } } })).count;
  report.editorFeedbackPurged = (await prisma.editorFeedback.deleteMany({ where: { status: "RESOLVED", updatedAt: { lte: auditCutoff } } })).count;
  report.supportAccessGrantsPurged = (await prisma.supportAccessGrant.deleteMany({ where: { createdAt: { lte: auditCutoff }, expiresAt: { lte: auditCutoff } } })).count;
  report.auditLogsPurged = (await prisma.auditLog.deleteMany({ where: { createdAt: { lte: auditCutoff } } })).count;
  report.rateLimitBucketsPurged = (await prisma.rateLimitBucket.deleteMany({ where: { windowStartedAt: { lte: rateLimitCutoff } } })).count;
  report.analyticsDailyPurged = (await prisma.analyticsDaily.deleteMany({ where: { date: { lte: auditCutoff } } })).count;
  report.platformAnalyticsDailyPurged = (await prisma.platformAnalyticsDaily.deleteMany({ where: { date: { lte: auditCutoff } } })).count;

  return report;
}
