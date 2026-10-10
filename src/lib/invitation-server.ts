import "server-only";

import { z } from "zod";
import { getTemplate } from "@/lib/templates";
import { EVENT_KINDS, safeHttpsUrl, type InvitationDraft } from "@/lib/invitations";
import { getPrismaClient } from "@/lib/prisma";
import { isR2PublicUrl, r2KeyFromPublicUrl } from "@/lib/r2";
import { isEditorCompatibleTemplate, TEMPLATE_SDK_VERSION, validateTemplateManifest } from "@/lib/template-sdk";
import { templateVersionRequiresAdminReview } from "@/templates/registry";

export const invitationDraftSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().trim().min(3).max(48).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  eventKind: z.enum(EVENT_KINDS),
  eventTitle: z.string().trim().max(120),
  hostOne: z.string().trim().max(80),
  hostTwo: z.string().trim().max(80),
  familyDetails: z.string().trim().max(600).default(""),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }),
  eventTime: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  venue: z.string().trim().max(160),
  address: z.string().trim().max(1000),
  mapsUrl: z.string().trim().max(2000).refine((value) => !value || Boolean(safeHttpsUrl(value))),
  story: z.string().trim().max(3000),
  templateId: z.string().min(1).max(80),
  templateVersion: z.string().min(1).max(32),
  themeColor: z.enum(["default", "rose", "ocean"]).default("default"),
  themeFont: z.enum(["classic", "modern"]).default("classic"),
  sectionOrder: z.enum(["story-first", "details-first"]).default("story-first"),
  coverPhoto: z.string().max(1_800_000).refine((value) => {
    if (!value) return true;
    if (isR2PublicUrl(value)) return true;
    const match = /^data:image\/(jpeg|png|webp);base64,([a-z\d+/]+={0,2})$/i.exec(value);
    if (!match) return false;
    const bytes = Buffer.from(match[2], "base64");
    if (match[1].toLowerCase() === "jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    if (match[1].toLowerCase() === "png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  }),
  coverPosition: z.number().int().min(0).max(100),
  coverPositionX: z.number().int().min(0).max(100).default(50),
  galleryPhotos: z.array(z.string().trim().max(2048)).max(6).default([]).refine((photos) => new Set(photos).size === photos.length && photos.every(isR2PublicUrl)),
  giftMessage: z.string().trim().max(300).default(""),
  giftBankName: z.string().trim().max(80).default(""),
  giftAccountName: z.string().trim().max(100).default(""),
  giftAccountNumber: z.string().trim().max(60).default(""),
  musicUrl: z.string().trim().max(2048).default("").refine((value) => !value || isR2PublicUrl(value)),
  musicTitle: z.string().trim().max(80).default(""),
  updatedAt: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),
  isPublished: z.boolean().optional(),
});

export function parseInvitationDraft(value: unknown): InvitationDraft | null {
  const result = invitationDraftSchema.safeParse(value);
  if (!result.success || !result.data.id) return null;
  return result.data as InvitationDraft;
}

export async function ownsInvitationCoverPhoto(userId: string, invitationId: string, coverPhoto: string) {
  const key = r2KeyFromPublicUrl(coverPhoto);
  if (!key) return false;
  const asset = await getPrismaClient().mediaVariant.findFirst({
    where: {
      storageKey: key,
      variantKey: "cover",
      mediaAsset: { invitationId, uploadedById: userId, status: "READY", deletedAt: null },
    },
    select: { id: true },
  });
  return Boolean(asset);
}

export async function ownsInvitationGalleryPhotos(userId: string, invitationId: string, photos: string[]) {
  if (!photos.length) return true;
  const keys = photos.map(r2KeyFromPublicUrl);
  if (keys.some((key) => !key) || new Set(keys).size !== keys.length) return false;
  const owned = await getPrismaClient().mediaVariant.findMany({
    where: {
      storageKey: { in: keys as string[] },
      variantKey: "gallery",
      mediaAsset: { invitationId, uploadedById: userId, status: "READY", deletedAt: null },
    },
    select: { storageKey: true },
  });
  return new Set(owned.map((variant) => variant.storageKey)).size === keys.length;
}

export async function ownsInvitationMusic(userId: string, invitationId: string, musicUrl: string) {
  if (!musicUrl) return true;
  const key = r2KeyFromPublicUrl(musicUrl);
  if (!key) return false;
  const asset = await getPrismaClient().mediaVariant.findFirst({
    where: { storageKey: key, variantKey: "music", mediaAsset: { invitationId, uploadedById: userId, status: "READY", deletedAt: null } },
    select: { id: true },
  });
  return Boolean(asset);
}

export function invitationTitle(draft: InvitationDraft) {
  return draft.eventKind === "Pernikahan"
    ? `${draft.hostOne} & ${draft.hostTwo}`.trim().slice(0, 160)
    : (draft.eventTitle || draft.eventKind).slice(0, 160);
}

export function eventStartsAt(draft: InvitationDraft) {
  return new Date(`${draft.eventDate}T${draft.eventTime}:00+07:00`);
}

export async function getWritableOrganizationId(userId: string) {
  const prisma = getPrismaClient();
  const membership = await prisma.membership.findFirst({
    where: {
      userId,
      role: { in: ["OWNER", "ADMIN", "EDITOR"] },
      organization: { status: "ACTIVE" },
    },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  return membership?.organizationId ?? null;
}

export async function ensureTemplateVersion(slug: string) {
  const templateData = getTemplate(slug);
  const prisma = getPrismaClient();
  if (!templateData) {
    const record = await prisma.template.findUnique({ where: { slug }, include: { activeVersion: true } });
    if (!record?.activeVersion) return null;
    const manifest = validateTemplateManifest(record.activeVersion.manifest);
    if (!manifest.success || manifest.data.slug !== slug || manifest.data.version !== record.activeVersion.version || !isEditorCompatibleTemplate(manifest.data)) return null;
    return { template: record, version: record.activeVersion, templateData: manifest.data };
  }
  const requiresAdminReview = templateVersionRequiresAdminReview(templateData.slug, templateData.version);
  const synced = await prisma.$transaction(async (tx) => {
    let template = await tx.template.upsert({
      where: { slug: templateData.slug },
      create: {
          slug: templateData.slug,
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          licenseType: templateData.price > 0 ? "PAID_PER_INVITATION" : "FREE",
          priceIdr: templateData.price,
          status: requiresAdminReview ? "IN_REVIEW" : "PUBLISHED",
      },
      update: {},
      include: { activeVersion: true },
    });

    const existingVersion = await tx.templateVersion.findUnique({ where: { templateId_version: { templateId: template.id, version: templateData.version } } });
    if (existingVersion) {
      if (stableJson(existingVersion.manifest) !== stableJson(templateData)) {
        throw new Error(`Template ${templateData.slug}@${templateData.version} changed without a semver increment.`);
      }
      return { template, version: existingVersion, activeVersion: template.activeVersion };
    }

    if (template.status === "ARCHIVED") {
      return { template, version: template.activeVersion, activeVersion: template.activeVersion };
    }

    const activeVersionNumber = template.activeVersion?.version;
    if (activeVersionNumber && compareTemplateVersions(templateData.version, activeVersionNumber) <= 0) {
      return { template, version: template.activeVersion, activeVersion: template.activeVersion };
    }

    const publishImmediately = !requiresAdminReview;
    const version = await tx.templateVersion.upsert({
      where: { templateId_version: { templateId: template.id, version: templateData.version } },
      create: {
        templateId: template.id,
        version: templateData.version,
        schemaVersion: templateData.schemaVersion,
        sdkVersion: TEMPLATE_SDK_VERSION,
        manifest: JSON.parse(JSON.stringify(templateData)),
        sourceRef: `src/templates/${templateData.slug}/index.tsx`,
        publishedAt: publishImmediately ? new Date() : null,
      },
      update: {},
    });
    template = await tx.template.update({
      where: { id: template.id },
      data: publishImmediately
        ? {
          status: "PUBLISHED",
          activeVersionId: version.id,
          name: templateData.name,
          description: templateData.description,
          category: templateData.category,
          licenseType: templateData.price > 0 ? "PAID_PER_INVITATION" : "FREE",
          priceIdr: templateData.price,
        }
        : { status: template.activeVersionId ? "UPDATE_IN_REVIEW" : "IN_REVIEW" },
      include: { activeVersion: true },
    });
    return { template, version, activeVersion: publishImmediately ? version : template.activeVersion };
  });

  const selectedVersion = requiresAdminReview && synced.activeVersion ? synced.activeVersion : synced.version;
  if (!selectedVersion) return null;
  const selectedManifest = validateTemplateManifest(selectedVersion.manifest);
  return {
    template: synced.template,
    version: selectedVersion,
    templateData: selectedManifest.success ? selectedManifest.data : templateData,
  };
}

function compareTemplateVersions(left: string, right: string) {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] - rightParts[index];
  }
  return 0;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "undefined";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}
