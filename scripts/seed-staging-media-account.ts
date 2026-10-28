import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";
import { ADULT_ATTESTATION_VERSION } from "../src/lib/consent-versions";

const stagingOrigin = "https://staging.tamukita.io";
const qaEmail = "media-qa@tamukita.invalid";
const qaName = "TamuKita Staging Media QA";
const organizationSlug = "tamukita-staging-media-qa";
const password = process.env.STAGING_MEDIA_QA_PASSWORD ?? "";

if (process.env.NEXT_PUBLIC_APP_URL !== stagingOrigin) {
  throw new Error(`Refusing to create QA credentials unless NEXT_PUBLIC_APP_URL is exactly ${stagingOrigin}.`);
}
if (!process.argv.includes("--confirm-staging-media-account")) {
  throw new Error("Pass --confirm-staging-media-account to create the synthetic staging-only QA account.");
}
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required inside the staging application network.");
}
if (password.length < 12 || password.length > 128) {
  throw new Error("Set STAGING_MEDIA_QA_PASSWORD to a unique 12–128 character staging-only password.");
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function seedStagingMediaAccount() {
  const now = new Date();
  const passwordHash = await hashPassword(password);

  const outcome = await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({ where: { email: qaEmail } });
    if (existingUser && (existingUser.name !== qaName || existingUser.platformRole !== "CUSTOMER")) {
      throw new Error(`Reserved QA email ${qaEmail} belongs to unexpected data; no changes were made.`);
    }

    const existingOrganization = await tx.organization.findUnique({ where: { slug: organizationSlug } });
    if (existingOrganization && (existingOrganization.name !== qaName || existingOrganization.type !== "PERSONAL" || existingOrganization.status !== "ACTIVE")) {
      throw new Error(`Reserved QA workspace ${organizationSlug} belongs to unexpected data; no changes were made.`);
    }

    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            emailVerified: now,
            passwordHash,
            adultAttestedAt: now,
            adultAttestationVersion: ADULT_ATTESTATION_VERSION,
            failedLoginAttempts: 0,
            lockedUntil: null,
            authVersion: { increment: 1 },
          },
          select: { id: true },
        })
      : await tx.user.create({
          data: {
            id: randomUUID(),
            name: qaName,
            email: qaEmail,
            emailVerified: now,
            passwordHash,
            adultAttestedAt: now,
            adultAttestationVersion: ADULT_ATTESTATION_VERSION,
            platformRole: "CUSTOMER",
          },
          select: { id: true },
        });

    const organization = existingOrganization
      ? existingOrganization
      : await tx.organization.create({
          data: { name: qaName, slug: organizationSlug, type: "PERSONAL", status: "ACTIVE" },
          select: { id: true, name: true, slug: true, type: true, status: true },
        });

    await tx.membership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: { role: "OWNER" },
      create: { organizationId: organization.id, userId: user.id, role: "OWNER" },
    });

    await tx.auditLog.create({
      data: {
        organizationId: organization.id,
        actorId: user.id,
        action: "staging.qa_media_account.provisioned",
        targetType: "User",
        targetId: user.id,
        metadata: { synthetic: true, purpose: "staging-media-integration" },
      },
    });

    return { created: !existingUser, userId: user.id };
  });

  process.stdout.write(`${outcome.created ? "Created" : "Updated"} synthetic staging media QA account ${qaEmail} (${outcome.userId}).\n`);
}

async function main() {
  try {
    await seedStagingMediaAccount();
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
