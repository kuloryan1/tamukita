import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { runDataRetentionSweep } from "@/lib/data-retention";

const databaseUrl = process.env.DATABASE_URL;
if (process.env.E2E_ALLOW_DESTRUCTIVE !== "1" || !databaseUrl) {
  throw new Error("Retention integration verification requires E2E_ALLOW_DESTRUCTIVE=1 and DATABASE_URL.");
}
const parsedDatabaseUrl = new URL(databaseUrl);
const localDatabaseHost = new Set(["localhost", "127.0.0.1", "::1"]).has(parsedDatabaseUrl.hostname);
const githubDisposableDatabase =
  process.env.GITHUB_ACTIONS === "true" &&
  process.env.E2E_ALLOW_GITHUB_SERVICE_DATABASE === "1" &&
  parsedDatabaseUrl.hostname === "postgres" &&
  parsedDatabaseUrl.port === "5432" &&
  parsedDatabaseUrl.pathname === "/tamukita" &&
  parsedDatabaseUrl.username === "ci" &&
  parsedDatabaseUrl.password === "ci";
if (!localDatabaseHost && !githubDisposableDatabase) {
  throw new Error("Retention integration verification only allows a local disposable database.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
const DAY_MS = 86_400_000;

async function verifyRetentionSweep() {
  const fixture = await prisma.invitation.findUnique({
    where: { id: "10000000-0000-4000-8000-000000000001" },
    select: { organizationId: true, ownerId: true, createdById: true, templateVersionId: true },
  });
  if (!fixture) throw new Error("The seeded E2E invitation fixture is required.");

  const now = new Date();
  const invitationId = randomUUID();
  const guestId = randomUUID();
  const orderId = randomUUID();
  const storageKey = `e2e-retention/${invitationId}/source.webp`;
  const variantKey = `e2e-retention/${invitationId}/variant.webp`;
  const deletionRequests: Array<{ bucket: string; key: string }> = [];

  try {
    await prisma.invitation.create({
      data: {
        id: invitationId,
        organizationId: fixture.organizationId,
        ownerId: fixture.ownerId,
        createdById: fixture.createdById,
        templateVersionId: fixture.templateVersionId,
        slug: `e2e-retention-${invitationId}`,
        title: "E2E retention fixture",
        status: "PUBLISHED",
        draftData: {},
        startsAt: new Date(now.getTime() - 180 * DAY_MS),
        expiresAt: new Date(now.getTime() - 150 * DAY_MS),
      },
    });
    await prisma.guest.create({ data: { id: guestId, organizationId: fixture.organizationId, name: "E2E retention guest" } });
    await prisma.rSVP.create({ data: { invitationId, guestId, displayName: "E2E retention guest", attendance: "ATTENDING" } });
    await prisma.guestLink.create({ data: { invitationId, guestId, tokenHash: randomUUID().replaceAll("-", "") } });
    const guestbook = await prisma.guestbookEntry.create({
      data: { invitationId, guestId, displayName: "E2E retention guest", message: "E2E retention report hold" },
    });
    const contentReport = await prisma.contentReport.create({
      data: { guestbookEntryId: guestbook.id, reporterFingerprint: randomUUID().replaceAll("-", ""), reason: "OTHER", status: "PENDING" },
    });
    await prisma.order.create({
      data: {
        id: orderId,
        organizationId: fixture.organizationId,
        buyerId: fixture.ownerId,
        invitationId,
        status: "PENDING",
        totalAmount: 1,
        idempotencyKey: randomUUID(),
        priceSnapshot: { flow: "E2E_RETENTION" },
      },
    });
    const media = await prisma.mediaAsset.create({
      data: {
        organizationId: fixture.organizationId,
        invitationId,
        uploadedById: fixture.ownerId,
        storageKey,
        originalName: "e2e-retention.webp",
        mimeType: "image/webp",
        sizeBytes: 1,
        deletedAt: new Date(now.getTime() - 150 * DAY_MS),
      },
    });
    await prisma.mediaVariant.create({
      data: { mediaAssetId: media.id, variantKey: "preview", storageKey: variantKey, mimeType: "image/webp", sizeBytes: 1 },
    });

    const retentionOptions = {
      now,
      privateBucket: "private-e2e",
      publicBucket: "public-e2e",
      deleteObject: async (bucket: string, key: string) => { deletionRequests.push({ bucket, key }); },
    };
    const pendingOrderReport = await runDataRetentionSweep(prisma, retentionOptions);
    assert.equal(pendingOrderReport.rsvpsPurged, 0, "pending orders must protect guest data");
    assert.equal(pendingOrderReport.guestbookEntriesPurged, 0);
    assert.equal(pendingOrderReport.mediaAssetsPurged, 0, "pending orders must protect media");
    assert.equal(deletionRequests.length, 0, "pending orders must not call object storage deletion");

    await prisma.order.update({ where: { id: orderId }, data: { status: "CANCELED" } });
    const pendingReportReport = await runDataRetentionSweep(prisma, retentionOptions);
    assert.equal(pendingReportReport.rsvpsPurged, 1);
    assert.equal(pendingReportReport.guestLinksPurged, 1);
    assert.equal(pendingReportReport.guestbookEntriesPurged, 0, "unresolved reports must protect guestbook entries");
    assert.equal(pendingReportReport.guestsPurged, 0, "held guestbook entries must protect linked guests");
    assert.equal(pendingReportReport.mediaAssetsPurged, 1);
    assert.deepEqual(deletionRequests.sort((a, b) => `${a.bucket}/${a.key}`.localeCompare(`${b.bucket}/${b.key}`)), [
      { bucket: "private-e2e", key: storageKey },
      { bucket: "private-e2e", key: variantKey },
      { bucket: "public-e2e", key: storageKey },
      { bucket: "public-e2e", key: variantKey },
    ].sort((a, b) => `${a.bucket}/${a.key}`.localeCompare(`${b.bucket}/${b.key}`)));

    await prisma.contentReport.update({
      where: { id: contentReport.id },
      data: { status: "DISMISSED", reviewedAt: new Date(now.getTime() - 400 * DAY_MS) },
    });
    const resolvedReportSweep = await runDataRetentionSweep(prisma, retentionOptions);
    assert.equal(resolvedReportSweep.guestbookEntriesPurged, 1);
    assert.equal(resolvedReportSweep.guestsPurged, 1);
    assert.equal(await prisma.contentReport.count({ where: { id: contentReport.id } }), 0);
    assert.equal(await prisma.guest.count({ where: { id: guestId } }), 0);
  } finally {
    await prisma.order.deleteMany({ where: { id: orderId } });
    await prisma.mediaAsset.deleteMany({ where: { invitationId } });
    await prisma.invitation.deleteMany({ where: { id: invitationId } });
    await prisma.guest.deleteMany({ where: { id: guestId } });
  }
}

verifyRetentionSweep()
  .then(() => console.log("Retention integration verification passed."))
  .catch((error: unknown) => {
    console.error("Retention integration verification failed.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
