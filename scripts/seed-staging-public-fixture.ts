import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";

const stagingOrigin = "https://staging.tamukita.io";
const fixtureSlug = "qa-blueprint-fixture";
const fixtureEmail = "qa-fixture@tamukita.invalid";
const fixtureName = "TamuKita Staging QA Fixture";
const fixtureOrganizationSlug = "tamukita-staging-qa-fixture";

if (process.env.NEXT_PUBLIC_APP_URL !== stagingOrigin) {
  throw new Error(`Refusing to seed QA data unless NEXT_PUBLIC_APP_URL is exactly ${stagingOrigin}.`);
}
if (!process.argv.includes("--confirm-staging-fixture")) {
  throw new Error("Pass --confirm-staging-fixture to create the public staging-only QA invitation.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required inside the staging application network.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function seedFixture() {
  const now = new Date();
  const draftId = randomUUID();
  const publishedAt = now.toISOString();
  const draft = {
    id: draftId,
    slug: fixtureSlug,
    eventKind: "Acara Lainnya",
    eventTitle: "Undangan Uji TamuKita — Staging",
    hostOne: "TamuKita QA",
    hostTwo: "",
    familyDetails: "Fixture uji publik; bukan undangan acara nyata.",
    eventDate: "2027-11-11",
    eventTime: "10:00",
    venue: "Lokasi contoh QA",
    address: "Data uji — bukan lokasi acara nyata.",
    mapsUrl: "",
    story: "Fixture QA publik untuk pengukuran TamuKita di lingkungan staging. Ini bukan undangan acara nyata.",
    templateId: "modern-sage",
    templateVersion: "",
    themeColor: "default",
    themeFont: "classic",
    sectionOrder: "story-first",
    coverPhoto: "",
    coverPosition: 50,
    coverPositionX: 50,
    galleryPhotos: [],
    giftMessage: "",
    giftBankName: "",
    giftAccountName: "",
    giftAccountNumber: "",
    musicUrl: "",
    musicTitle: "",
    customFields: {},
    updatedAt: publishedAt,
    publishedAt,
    isPublished: true,
    qaFixture: true,
  };

  const outcome = await prisma.$transaction(async (tx) => {
    const existingInvitation = await tx.invitation.findUnique({
      where: { slug: fixtureSlug },
      select: {
        id: true,
        draftData: true,
        owner: { select: { email: true } },
        organization: { select: { slug: true } },
      },
    });
    if (existingInvitation) {
      const existingDraft = existingInvitation.draftData;
      if (existingInvitation.owner.email !== fixtureEmail
        || existingInvitation.organization.slug !== fixtureOrganizationSlug
        || typeof existingDraft !== "object"
        || existingDraft === null
        || Array.isArray(existingDraft)
        || (existingDraft as Record<string, unknown>).qaFixture !== true) {
        throw new Error(`Slug ${fixtureSlug} already belongs to a non-fixture invitation; no data was changed.`);
      }
      return { created: false, invitationId: existingInvitation.id };
    }

    const template = await tx.template.findUnique({
      where: { slug: "modern-sage" },
      select: { status: true, activeVersionId: true, activeVersion: { select: { version: true } } },
    });
    if (template?.status !== "PUBLISHED" || !template.activeVersionId || !template.activeVersion) {
      throw new Error("The published modern-sage template is missing. Open /templates on staging, then retry.");
    }
    draft.templateVersion = template.activeVersion.version;
    const snapshot = JSON.parse(JSON.stringify(draft)) as Prisma.InputJsonValue;
    const startsAt = new Date(`${draft.eventDate}T${draft.eventTime}:00+07:00`);

    let user = await tx.user.findUnique({ where: { email: fixtureEmail } });
    if (user) {
      if (user.name !== fixtureName || user.passwordHash !== null || user.platformRole !== "CUSTOMER") {
        throw new Error(`Fixture email ${fixtureEmail} is already used by a non-fixture account; no data was changed.`);
      }
    } else {
      user = await tx.user.create({
        data: { name: fixtureName, email: fixtureEmail, emailVerified: now, platformRole: "CUSTOMER" },
      });
    }

    let organization = await tx.organization.findUnique({ where: { slug: fixtureOrganizationSlug } });
    if (organization) {
      if (organization.name !== fixtureName || organization.type !== "PERSONAL" || organization.status !== "ACTIVE") {
        throw new Error(`Fixture workspace ${fixtureOrganizationSlug} is already used by other data; no data was changed.`);
      }
    } else {
      organization = await tx.organization.create({
        data: { name: fixtureName, slug: fixtureOrganizationSlug, type: "PERSONAL", status: "ACTIVE" },
      });
    }

    await tx.membership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: { role: "OWNER" },
      create: { organizationId: organization.id, userId: user.id, role: "OWNER" },
    });

    const invitation = await tx.invitation.create({
      data: {
        organizationId: organization.id,
        ownerId: user.id,
        createdById: user.id,
        templateVersionId: template.activeVersionId,
        slug: fixtureSlug,
        title: draft.eventTitle,
        status: "PUBLISHED",
        draftData: snapshot,
        publishedSnapshot: snapshot,
        publishedAt: now,
        startsAt,
        versions: { create: [{ version: 1, type: "PUBLISHED", snapshot, createdById: user.id }] },
        events: {
          create: [{
            title: draft.eventTitle,
            startsAt,
            venue: draft.venue,
            address: draft.address,
            mapsUrl: null,
          }],
        },
      },
      select: { id: true },
    });
    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        actorId: user.id,
        action: "staging.qa_fixture.published",
        targetType: "Invitation",
        targetId: invitation.id,
        metadata: { slug: fixtureSlug, purpose: "staging-quality-gate", synthetic: true },
      },
    });
    return { created: true, invitationId: invitation.id };
  });

  process.stdout.write(`${outcome.created ? "Created" : "Already present"} staging QA fixture: ${stagingOrigin}/${fixtureSlug}\n`);
}

try {
  await seedFixture();
} finally {
  await prisma.$disconnect();
}
