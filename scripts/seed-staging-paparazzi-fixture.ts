import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const origin = "https://staging.tamukita.io";
const slug = "qa-paparazi-fixture";
const source = "STAGING_PAPARAZZI_FIXTURE";
const ownerEmail = process.env.STAGING_PAPARAZZI_OWNER_EMAIL?.trim().toLowerCase();
if (process.env.NEXT_PUBLIC_APP_URL !== origin || !process.argv.includes("--confirm-staging-paparazzi-fixture")) throw new Error("This fixture requires the exact staging origin and --confirm-staging-paparazzi-fixture.");
if (!process.env.DATABASE_URL || !ownerEmail) throw new Error("DATABASE_URL and STAGING_PAPARAZZI_OWNER_EMAIL are required.");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const owner = await prisma.user.findFirst({ where: { email: ownerEmail, platformRole: "SUPER_ADMIN" }, select: { id: true } });
  if (!owner) throw new Error("The existing staging Super Admin owner was not found.");
  const organization = await prisma.organization.findFirst({ where: { type: "PERSONAL", status: "ACTIVE", memberships: { some: { userId: owner.id, role: "OWNER" } } }, select: { id: true } });
  if (!organization) throw new Error("The owner needs an active personal workspace.");
  const existing = await prisma.invitation.findUnique({ where: { slug }, select: { id: true, ownerId: true } });
  if (existing) {
    const license = await prisma.templateLicense.findFirst({ where: { invitationId: existing.id }, select: { licenseSnapshot: true } });
    const marker = license?.licenseSnapshot;
    if (existing.ownerId !== owner.id || !marker || typeof marker !== "object" || Array.isArray(marker) || marker.activationSource !== source) throw new Error("The reserved fixture slug belongs to unexpected data; no changes were made.");
    console.info(JSON.stringify({ created: false, ownerPage: `${origin}/dashboard/invitations/${existing.id}/paparazi` }));
    return;
  }
  const template = await prisma.template.findUnique({ where: { slug: "royal-gold" }, include: { activeVersion: true } });
  if (template?.status !== "PUBLISHED" || !template.activeVersion) throw new Error("The existing Royal Gold published template is required.");
  const version = template.activeVersion;
  const now = new Date(); const id = randomUUID(); const title = "QA Paparazi · Galeri Acara";
  const eventDate = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const startsAt = new Date(`${eventDate}T10:00:00+07:00`);
  const expiresAt = new Date(now.getTime() + 14 * 86_400_000);
  const snapshot = {
    id, slug, eventKind: "Pernikahan", eventTitle: "Acara Uji Paparazi", hostOne: "QA Paparazi", hostTwo: "TamuKita", sealMonogram: "QA", familyDetails: "",
    eventDate, eventTime: "10:00", venue: "Acara pengujian TamuKita", address: "Fixture staging. Tidak ada acara nyata.", mapsUrl: "",
    story: "Acara khusus untuk mencoba QR, kamera, unggahan, dan galeri publik TamuKita. Gunakan foto uji tanpa data pribadi.",
    templateId: template.slug, templateVersion: version.version, themeColor: "default", themeFont: "classic", sectionOrder: "story-first", coverPhoto: "", coverPosition: 50, coverPositionX: 50,
    galleryPhotos: [], giftMessage: "", giftBankName: "", giftAccountName: "", giftAccountNumber: "", musicUrl: "", musicTitle: "", customFields: {}, updatedAt: now.toISOString(), publishedAt: now.toISOString(),
  };
  await prisma.$transaction(async tx => {
    await tx.invitation.create({ data: { id, organizationId: organization.id, ownerId: owner.id, createdById: owner.id, templateVersionId: version.id, slug, title, status: "PUBLISHED", startsAt, expiresAt, publishedAt: now, draftData: snapshot, publishedSnapshot: snapshot } });
    await tx.templateLicense.create({ data: { organizationId: organization.id, invitationId: id, templateId: template.id, templateVersionId: version.id, licenseSnapshot: { licenseType: template.licenseType, activationSource: source, qaOnly: true } } });
    await tx.entitlement.create({ data: { organizationId: organization.id, invitationId: id, featureKey: "hosting", value: { source, periodDays: 14, qaOnly: true }, startsAt: now, expiresAt } });
    await tx.invitationVersion.create({ data: { invitationId: id, version: 1, type: "PUBLISHED", snapshot, createdById: owner.id } });
    await tx.event.create({ data: { invitationId: id, title, startsAt, venue: snapshot.venue, address: snapshot.address } });
    await tx.auditLog.create({ data: { organizationId: organization.id, actorId: owner.id, action: "staging.paparazzi_fixture_created", targetType: "Invitation", targetId: id, metadata: { source, qaOnly: true, hostingDays: 14 } } });
  });
  console.info(JSON.stringify({ created: true, ownerPage: `${origin}/dashboard/invitations/${id}/paparazi`, publicPage: `${origin}/${slug}` }));
}

main().catch(error => { console.error(error instanceof Error ? error.message : "Staging photo fixture failed."); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
