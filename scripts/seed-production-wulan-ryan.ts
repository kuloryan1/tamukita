import { randomBytes, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { ADMIN_SAMPLE_PUBLICATION_MODE, isAdminSampleSnapshot } from "../src/lib/invitation-publication";
import { templates } from "../src/lib/templates";
import { TEMPLATE_SDK_VERSION } from "../src/lib/template-sdk";

const productionOrigin = "https://tamukita.io";
const invitationSlug = "wulan-dan-ryan";
const coverPhoto = "/templates/elegant-cream/wulan-dan-ryan-couple.webp";
const albumClosesAt = new Date("2026-12-21T19:00:00+07:00");
const wedding = {
  hostOne: "Ryan Pratama",
  hostTwo: "Dwi Wulan Maulida",
  hostOneParents: "Bpk. Mismanto & Ibu Farida",
  hostTwoParents: "Bpk. Suyitno & Ibu Sri Indriati",
  eventDate: "2026-11-21",
  eventTime: "19:00",
  venue: "Gedung Graha Wisata Surabaya",
  address: "Blok N–O, Jl. Wisata Menanggal No. 38, Dukuh Menanggal, Kec. Gayungan, Surabaya",
  story: "Dengan penuh syukur, kami mengundang Anda untuk merayakan hari istimewa ini bersama.",
} as const;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function asRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function main() {
  let configuredOrigin = "";
  try { configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL).origin : ""; } catch { /* Invalid URLs are not production. */ }
  if (configuredOrigin !== productionOrigin) {
    process.stdout.write("Skipped production sample seed outside https://tamukita.io.\n");
    return;
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required for the production sample seed.");

  const templateData = templates.find((template) => template.slug === "elegant-cream");
  if (!templateData) throw new Error("The Elegant Cream template manifest is missing.");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

  try {
    const now = new Date();
    const existingTemplate = await prisma.template.findUnique({ where: { slug: templateData.slug }, include: { activeVersion: true } });
    if (existingTemplate?.activeVersion && compareVersions(existingTemplate.activeVersion.version, templateData.version) > 0) {
      throw new Error("Production has a newer Elegant Cream version than this release; refusing to roll it back.");
    }
    const manifest = JSON.parse(JSON.stringify(templateData)) as Prisma.InputJsonValue;
    const existingVersion = existingTemplate
      ? await prisma.templateVersion.findUnique({ where: { templateId_version: { templateId: existingTemplate.id, version: templateData.version } } })
      : null;
    if (existingVersion && stableJson(existingVersion.manifest) !== stableJson(manifest)) {
      throw new Error("Elegant Cream changed without a template version increment.");
    }
    const template = await prisma.template.upsert({
      where: { slug: templateData.slug },
      create: {
        slug: templateData.slug, name: templateData.name, description: templateData.description,
        category: templateData.category, licenseType: "PAID_PER_INVITATION", priceIdr: templateData.price, status: "PUBLISHED",
      },
      update: {
        name: templateData.name, description: templateData.description, category: templateData.category,
        licenseType: "PAID_PER_INVITATION", priceIdr: templateData.price, status: "PUBLISHED",
      },
      select: { id: true },
    });
    const version = await prisma.templateVersion.upsert({
      where: { templateId_version: { templateId: template.id, version: templateData.version } },
      create: {
        templateId: template.id, version: templateData.version, schemaVersion: templateData.schemaVersion,
        sdkVersion: TEMPLATE_SDK_VERSION, manifest, sourceRef: "src/templates/elegant-cream/index.tsx", publishedAt: now,
      },
      update: {},
      select: { id: true },
    });
    await prisma.template.update({ where: { id: template.id }, data: { activeVersionId: version.id, status: "PUBLISHED" } });

    const admin = await prisma.user.findFirst({
      where: { platformRole: "SUPER_ADMIN", memberships: { some: { role: "OWNER", organization: { type: "PERSONAL", status: "ACTIVE" } } } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        memberships: {
          where: { role: "OWNER", organization: { type: "PERSONAL", status: "ACTIVE" } },
          orderBy: { createdAt: "asc" }, take: 1, select: { organizationId: true },
        },
      },
    });
    if (!admin?.memberships[0]) throw new Error("No active Super Admin personal workspace is available for the sample invitation.");

    const existing = await prisma.invitation.findUnique({
      where: { slug: invitationSlug },
      select: {
        id: true, ownerId: true, createdById: true, organizationId: true, status: true,
        deletedAt: true, publishedAt: true, draftData: true, publishedSnapshot: true,
        owner: { select: { platformRole: true } }, organization: { select: { type: true, status: true } },
      },
    });
    if (existing && (existing.owner.platformRole !== "SUPER_ADMIN"
      || existing.organization.type !== "PERSONAL"
      || existing.organization.status !== "ACTIVE"
      || existing.deletedAt
      || !["DRAFT", "PUBLISHED"].includes(existing.status)
      || (existing.status === "PUBLISHED" && !isAdminSampleSnapshot(existing.publishedSnapshot)))) {
      throw new Error("The requested public slug is already used by a non-sample invitation; no invitation data was changed.");
    }

    const invitationId = existing?.id ?? randomUUID();
    const ownerId = existing?.ownerId ?? admin.id;
    const organizationId = existing?.organizationId ?? admin.memberships[0].organizationId;
    const createdById = existing?.createdById ?? admin.id;
    const publishedAt = existing?.publishedAt ?? now;
    const configuredHostingDays = await prisma.platformSetting.findUnique({ where: { key: "invitation.hosting_term_days" }, select: { value: true } });
    const settingDays = configuredHostingDays?.value;
    const hostingTermDays = typeof settingDays === "number" && Number.isInteger(settingDays) && settingDays >= 30 && settingDays <= 3_650 ? settingDays : 365;
    const expiresAt = new Date(now.getTime() + hostingTermDays * 86_400_000);
    const eventTitle = `Pernikahan ${wedding.hostOne} & ${wedding.hostTwo}`;
    const mapsLocation = `${wedding.venue}, ${wedding.address}`;
    const baseDraft = {
      id: invitationId, slug: invitationSlug, eventKind: "Pernikahan", eventTitle,
      ...wedding, sealMonogram: "WR", familyDetails: "", mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsLocation)}`,
      templateId: "elegant-cream", templateVersion: templateData.version, themeColor: "default", themeFont: "classic",
      sectionOrder: "story-first", coverPhoto, coverPosition: 50, coverPositionX: 50, hostOnePhoto: "", hostTwoPhoto: "",
      galleryPhotos: [], eventSchedule: [], giftMessage: "", giftBankName: "", giftAccountName: "", giftAccountNumber: "",
      giftBankName2: "", giftAccountName2: "", giftAccountNumber2: "", musicUrl: "", musicTitle: "",
      customFields: { eventSectionHeading: "Detail Acara", closingNames: "Ryan & Wulan" },
    };
    const previousDraft = asRecord(existing?.draftData);
    const sameDraft = stableJson({ ...previousDraft, updatedAt: undefined }) === stableJson({ ...baseDraft, updatedAt: undefined });
    const updatedAt = sameDraft && typeof previousDraft.updatedAt === "string" ? previousDraft.updatedAt : now.toISOString();
    const draft = { ...baseDraft, updatedAt };
    const snapshot = { ...draft, publishedAt: publishedAt.toISOString(), publicationMode: ADMIN_SAMPLE_PUBLICATION_MODE };
    const jsonDraft = JSON.parse(JSON.stringify(draft)) as Prisma.InputJsonValue;
    const jsonSnapshot = JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue;
    const startsAt = new Date(`${wedding.eventDate}T${wedding.eventTime}:00+07:00`);
    const title = `${wedding.hostOne} & ${wedding.hostTwo}`;
    const hasChanged = !existing || stableJson(existing.publishedSnapshot) !== stableJson(snapshot);
    const savedAlbum = await prisma.paparazziAlbum.findUnique({ where: { invitationId }, select: { token: true } });
    const albumToken = savedAlbum?.token && /^[0-9a-f]{64}$/.test(savedAlbum.token) ? savedAlbum.token : randomBytes(32).toString("hex");

    await prisma.$transaction(async (tx) => {
      await tx.invitation.upsert({
        where: { slug: invitationSlug },
        create: {
          id: invitationId, organizationId, ownerId, createdById, templateVersionId: version.id, slug: invitationSlug, title,
          status: "PUBLISHED", draftData: jsonDraft, publishedSnapshot: jsonSnapshot, publishedAt,
          formCompletedAt: now, startsAt, expiresAt,
        },
        update: {
          templateVersionId: version.id, title, status: "PUBLISHED", draftData: jsonDraft,
          publishedSnapshot: jsonSnapshot, publishedAt, formCompletedAt: existing?.status === "PUBLISHED" ? undefined : now,
          startsAt, expiresAt, deletedAt: null,
        },
      });

      const eventData = { title, startsAt, venue: wedding.venue, address: wedding.address, mapsUrl: baseDraft.mapsUrl };
      const events = await tx.event.updateMany({ where: { invitationId }, data: eventData });
      if (events.count === 0) await tx.event.create({ data: { invitationId, ...eventData } });

      const latestVersion = await tx.invitationVersion.findFirst({ where: { invitationId }, orderBy: { version: "desc" }, select: { version: true, snapshot: true } });
      if (!latestVersion || stableJson(latestVersion.snapshot) !== stableJson(jsonSnapshot)) {
        await tx.invitationVersion.create({
          data: { invitationId, version: (latestVersion?.version ?? 0) + 1, type: "PUBLISHED", snapshot: jsonSnapshot, createdById },
        });
      }

      await tx.templateLicense.upsert({
        where: { invitationId_templateVersionId: { invitationId, templateVersionId: version.id } },
        create: {
          organizationId, invitationId, templateId: template.id, templateVersionId: version.id,
          licenseSnapshot: { licenseType: "PAID_PER_INVITATION", templateSlug: "elegant-cream", templateVersion: templateData.version, amountIdr: 0, source: "SUPER_ADMIN_SAMPLE" },
        },
        update: {},
      });

      const activeHosting = await tx.entitlement.findFirst({
        where: { invitationId, featureKey: "hosting", status: "ACTIVE", startsAt: { lte: now }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        select: { id: true },
      });
      if (activeHosting) {
        await tx.entitlement.update({ where: { id: activeHosting.id }, data: { expiresAt, value: { periodDays: hostingTermDays, source: "SUPER_ADMIN_SAMPLE" } } });
      } else {
        await tx.entitlement.create({ data: { organizationId, invitationId, featureKey: "hosting", value: { periodDays: hostingTermDays, source: "SUPER_ADMIN_SAMPLE" }, startsAt: now, expiresAt } });
      }

      await tx.paparazziAlbum.upsert({
        where: { invitationId },
        create: { invitationId, token: albumToken, enabled: true, closesAt: albumClosesAt, maxPhotos: 200 },
        update: { ...(savedAlbum?.token === albumToken ? {} : { token: albumToken }), enabled: true, closesAt: albumClosesAt, maxPhotos: 200 },
      });

      if (hasChanged) {
        await tx.auditLog.create({
          data: {
            organizationId, actorId: admin.id, action: "invitation.production_sample.reconciled",
            targetType: "Invitation", targetId: invitationId,
            metadata: { slug: invitationSlug, template: "elegant-cream", paparazziEnabled: true, publicationMode: "ADMIN_SAMPLE" },
          },
        });
      }
    });

    process.stdout.write(`Production sample reconciled: /${invitationSlug}; Elegant Cream and Paparazi are enabled.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
