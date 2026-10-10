import { createHmac, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { createInitialDraft } from "@/lib/invitations";
import { hashPassword } from "@/lib/password";
import { templates } from "@/lib/templates";
import { TEMPLATE_SDK_VERSION } from "@/lib/template-sdk";

const connectionString = process.env.DATABASE_URL;
const authSecret = process.env.AUTH_SECRET ?? "";
const adminEmail = process.env.E2E_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const financeEmail = process.env.E2E_FINANCE_EMAIL?.trim().toLowerCase();
const financePassword = process.env.E2E_FINANCE_PASSWORD;
const customerEmail = process.env.E2E_CUSTOMER_EMAIL?.trim().toLowerCase();
const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;
const otherCustomerEmail = process.env.E2E_OTHER_CUSTOMER_EMAIL?.trim().toLowerCase();
const otherCustomerPassword = process.env.E2E_OTHER_CUSTOMER_PASSWORD;
const mobileCustomerEmail = process.env.E2E_MOBILE_CUSTOMER_EMAIL?.trim().toLowerCase();
const mobileCustomerPassword = process.env.E2E_MOBILE_CUSTOMER_PASSWORD;
const webkitCustomerEmail = process.env.E2E_WEBKIT_CUSTOMER_EMAIL?.trim().toLowerCase();
const webkitCustomerPassword = process.env.E2E_WEBKIT_CUSTOMER_PASSWORD;
const resellerReportOwnerEmail = process.env.E2E_RESELLER_REPORT_OWNER_EMAIL?.trim().toLowerCase();
const resellerReportOwnerPassword = process.env.E2E_RESELLER_REPORT_OWNER_PASSWORD;
const templateDeveloperEmail = process.env.E2E_TEMPLATE_DEVELOPER_EMAIL?.trim().toLowerCase();
const templateDeveloperPassword = process.env.E2E_TEMPLATE_DEVELOPER_PASSWORD;
const contentReviewerEmail = process.env.E2E_CONTENT_REVIEWER_EMAIL?.trim().toLowerCase();
const contentReviewerPassword = process.env.E2E_CONTENT_REVIEWER_PASSWORD;
const refundResellerEmail = process.env.E2E_REFUND_RESELLER_EMAIL?.trim().toLowerCase();
const refundResellerPassword = process.env.E2E_REFUND_RESELLER_PASSWORD;

if (
  !connectionString
  || !authSecret
  || !adminEmail
  || !adminPassword
  || adminPassword.length < 12
  || !financeEmail
  || !financePassword
  || financePassword.length < 12
  || !customerEmail
  || !customerPassword
  || customerPassword.length < 12
  || !otherCustomerEmail
  || !otherCustomerPassword
  || otherCustomerPassword.length < 12
  || !mobileCustomerEmail
  || !mobileCustomerPassword
  || mobileCustomerPassword.length < 12
  || !webkitCustomerEmail
  || !webkitCustomerPassword
  || webkitCustomerPassword.length < 12
  || !resellerReportOwnerEmail
  || !resellerReportOwnerPassword
  || resellerReportOwnerPassword.length < 12
  || !templateDeveloperEmail
  || !templateDeveloperPassword
  || templateDeveloperPassword.length < 12
  || !contentReviewerEmail
  || !contentReviewerPassword
  || contentReviewerPassword.length < 12
  || !refundResellerEmail
  || !refundResellerPassword
  || refundResellerPassword.length < 12
) {
  throw new Error("Set DATABASE_URL, AUTH_SECRET, and all E2E admin/finance/customer/template-developer/content-reviewer/refund-reseller/WebKit-customer/reseller-report-owner emails and passwords; every password must have at least 12 characters.");
}

const e2eAccounts = {
  admin: { email: adminEmail, password: adminPassword },
  finance: { email: financeEmail, password: financePassword },
  customer: { email: customerEmail, password: customerPassword },
  otherCustomer: { email: otherCustomerEmail, password: otherCustomerPassword },
  mobileCustomer: { email: mobileCustomerEmail, password: mobileCustomerPassword },
  webkitCustomer: { email: webkitCustomerEmail, password: webkitCustomerPassword },
  resellerReportOwner: { email: resellerReportOwnerEmail, password: resellerReportOwnerPassword },
  templateDeveloper: { email: templateDeveloperEmail, password: templateDeveloperPassword },
  contentReviewer: { email: contentReviewerEmail, password: contentReviewerPassword },
  refundReseller: { email: refundResellerEmail, password: refundResellerPassword },
};

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function seedE2eFixtures() {
try {
  const e2eLoginBucketKeys = Object.values(e2eAccounts).map(({ email }) =>
    createHmac("sha256", authSecret).update(`login:${email}`).digest("hex"),
  );
  await prisma.rateLimitBucket.deleteMany({ where: { key: { in: e2eLoginBucketKeys } } });

  async function seedAccount({ email, password, name, platformRole }: {
    email: string;
    password: string;
    name: string;
    platformRole: "CUSTOMER" | "SUPER_ADMIN" | "FINANCE" | "TEMPLATE_DEVELOPER" | "CONTENT_REVIEWER";
  }): Promise<{ userId: string; organizationId: string }> {
    const now = new Date();
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.upsert({
      where: { email },
      update: { name, emailVerified: now, passwordHash, platformRole, failedLoginAttempts: 0, lockedUntil: null },
      create: { id: randomUUID(), name, email, emailVerified: now, passwordHash, platformRole },
      select: { id: true },
    });
    const accountType = platformRole === "SUPER_ADMIN" ? "admin" : platformRole === "FINANCE" ? "finance" : platformRole === "TEMPLATE_DEVELOPER" ? "developer" : platformRole === "CONTENT_REVIEWER" ? "content-reviewer" : "customer";
    const organizationSlug = `e2e-${accountType}-${user.id.slice(0, 8)}`;
    const organization = await prisma.organization.upsert({
      where: { slug: organizationSlug },
      update: { name: `E2E ${name} Workspace`, status: "ACTIVE", type: "PERSONAL" },
      create: { name: `E2E ${name} Workspace`, slug: organizationSlug, type: "PERSONAL" },
      select: { id: true },
    });
    await prisma.membership.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: user.id } },
      update: { role: "OWNER" },
      create: { organizationId: organization.id, userId: user.id, role: "OWNER" },
    });
    return { userId: user.id, organizationId: organization.id };
  }

  await seedAccount({ ...e2eAccounts.admin, name: "E2E Admin", platformRole: "SUPER_ADMIN" });
  await seedAccount({ ...e2eAccounts.finance, name: "E2E Finance", platformRole: "FINANCE" });
  const customer = await seedAccount({ ...e2eAccounts.customer, name: "E2E Customer", platformRole: "CUSTOMER" });
  const otherCustomer = await seedAccount({ ...e2eAccounts.otherCustomer, name: "E2E Other Customer", platformRole: "CUSTOMER" });
  const mobileCustomer = await seedAccount({ ...e2eAccounts.mobileCustomer, name: "E2E Mobile Customer", platformRole: "CUSTOMER" });
  const webkitCustomer = await seedAccount({ ...e2eAccounts.webkitCustomer, name: "E2E WebKit Customer", platformRole: "CUSTOMER" });
  const templateDeveloper = await seedAccount({ ...e2eAccounts.templateDeveloper, name: "E2E Template Developer", platformRole: "TEMPLATE_DEVELOPER" });
  await seedAccount({ ...e2eAccounts.contentReviewer, name: "E2E Content Reviewer", platformRole: "CONTENT_REVIEWER" });
  const refundReseller = await seedAccount({ ...e2eAccounts.refundReseller, name: "E2E Refund Reseller", platformRole: "CUSTOMER" });
  const resellerReportOwner = await seedAccount({ ...e2eAccounts.resellerReportOwner, name: "E2E Reseller Report Owner", platformRole: "CUSTOMER" });
  const developerTemplateBucketKey = createHmac("sha256", authSecret).update(`developer:templates:${templateDeveloper.userId}`).digest("hex");
  await prisma.rateLimitBucket.deleteMany({ where: { key: developerTemplateBucketKey } });

  const fixtureTemplate = templates[0];
  const fixtureInvitationId = "10000000-0000-4000-8000-000000000001";
  const fixtureSlug = "e2e-public-invite";
  const now = new Date();
  const manifest = JSON.parse(JSON.stringify(fixtureTemplate));
  const template = await prisma.template.upsert({
    where: { slug: fixtureTemplate.slug },
    update: {
      name: fixtureTemplate.name,
      description: fixtureTemplate.description,
      category: fixtureTemplate.category,
      licenseType: "PAID_PER_INVITATION",
      priceIdr: fixtureTemplate.price,
      status: "PUBLISHED",
    },
    create: {
      slug: fixtureTemplate.slug,
      name: fixtureTemplate.name,
      description: fixtureTemplate.description,
      category: fixtureTemplate.category,
      licenseType: "PAID_PER_INVITATION",
      priceIdr: fixtureTemplate.price,
      status: "PUBLISHED",
    },
    select: { id: true },
  });
  const templateVersion = await prisma.templateVersion.upsert({
    where: { templateId_version: { templateId: template.id, version: fixtureTemplate.version } },
    update: { schemaVersion: fixtureTemplate.schemaVersion, sdkVersion: TEMPLATE_SDK_VERSION, manifest, publishedAt: now },
    create: {
      templateId: template.id,
      version: fixtureTemplate.version,
      schemaVersion: fixtureTemplate.schemaVersion,
      sdkVersion: TEMPLATE_SDK_VERSION,
      manifest,
      sourceRef: `src/templates/${fixtureTemplate.slug}/index.tsx`,
      publishedAt: now,
    },
    select: { id: true },
  });
  await prisma.template.update({ where: { id: template.id }, data: { activeVersionId: templateVersion.id, status: "PUBLISHED" } });

  const draft = {
    ...createInitialDraft(),
    id: fixtureInvitationId,
    slug: fixtureSlug,
    hostOne: "E2E Mempelai",
    hostTwo: "E2E Pasangan",
    eventTitle: "Undangan E2E",
    eventDate: "2030-05-22",
    eventTime: "10:00",
    venue: "Taman Uji",
    address: "Jl. Pengujian No. 1, Jakarta",
    story: "Undangan fixture untuk memeriksa RSVP publik dan moderasi ucapan.",
    templateId: fixtureTemplate.slug,
    templateVersion: fixtureTemplate.version,
    updatedAt: now.toISOString(),
    publishedAt: now.toISOString(),
  };
  const snapshot = JSON.parse(JSON.stringify(draft));
  const startsAt = new Date(`${draft.eventDate}T${draft.eventTime}:00+07:00`);
  const expiresAt = new Date(now.getTime() + 365 * 86_400_000);
  await prisma.$transaction(async (tx) => {
    await tx.guestbookEntry.deleteMany({ where: { invitationId: fixtureInvitationId } });
    await tx.rSVP.deleteMany({ where: { invitationId: fixtureInvitationId } });
    await tx.guestLink.deleteMany({ where: { invitationId: fixtureInvitationId } });
    await tx.invitation.upsert({
      where: { slug: fixtureSlug },
      update: {
        organizationId: customer.organizationId,
        ownerId: customer.userId,
        createdById: customer.userId,
        resellerOrgId: null,
        templateVersionId: templateVersion.id,
        title: `${draft.hostOne} & ${draft.hostTwo}`,
        status: "PUBLISHED",
        draftData: snapshot,
        publishedSnapshot: snapshot,
        publishedAt: now,
        expiresAt,
        deletedAt: null,
      },
      create: {
        id: fixtureInvitationId,
        organizationId: customer.organizationId,
        ownerId: customer.userId,
        createdById: customer.userId,
        templateVersionId: templateVersion.id,
        slug: fixtureSlug,
        title: `${draft.hostOne} & ${draft.hostTwo}`,
        status: "PUBLISHED",
        draftData: snapshot,
        publishedSnapshot: snapshot,
        publishedAt: now,
        expiresAt,
      },
    });
    await tx.invitationVersion.upsert({
      where: { invitationId_version: { invitationId: fixtureInvitationId, version: 1 } },
      update: { type: "PUBLISHED", snapshot, createdById: customer.userId },
      create: { invitationId: fixtureInvitationId, version: 1, type: "PUBLISHED", snapshot, createdById: customer.userId },
    });
    const existingEvent = await tx.event.findFirst({ where: { invitationId: fixtureInvitationId }, select: { id: true } });
    if (existingEvent) {
      await tx.event.update({ where: { id: existingEvent.id }, data: { title: `${draft.hostOne} & ${draft.hostTwo}`, startsAt, venue: draft.venue, address: draft.address, mapsUrl: null } });
    } else {
      await tx.event.create({ data: { invitationId: fixtureInvitationId, title: `${draft.hostOne} & ${draft.hostTwo}`, startsAt, venue: draft.venue, address: draft.address, mapsUrl: null } });
    }
    await tx.templateLicense.upsert({
      where: { invitationId_templateVersionId: { invitationId: fixtureInvitationId, templateVersionId: templateVersion.id } },
      update: { organizationId: customer.organizationId, templateId: template.id, licenseSnapshot: { licenseType: "PAID_PER_INVITATION", activationSource: "E2E_FIXTURE" } },
      create: { organizationId: customer.organizationId, invitationId: fixtureInvitationId, templateId: template.id, templateVersionId: templateVersion.id, licenseSnapshot: { licenseType: "PAID_PER_INVITATION", activationSource: "E2E_FIXTURE" } },
    });
  });

  const paymentInvitationId = "10000000-0000-4000-8000-000000000002";
  const paymentInvitationSlug = "e2e-payment-invite";
  const paymentDraft = {
    ...createInitialDraft(),
    id: paymentInvitationId,
    slug: paymentInvitationSlug,
    hostOne: "E2E Pembayaran",
    hostTwo: "E2E Terbit",
    eventTitle: "Undangan Pembayaran E2E",
    eventDate: "2030-06-22",
    eventTime: "11:00",
    venue: "Taman Pembayaran",
    address: "Jl. Callback No. 2, Jakarta",
    story: "Draft fixture untuk menguji konfirmasi pembayaran Xendit.",
    templateId: fixtureTemplate.slug,
    templateVersion: fixtureTemplate.version,
    updatedAt: now.toISOString(),
  };
  const paymentSnapshot = JSON.parse(JSON.stringify(paymentDraft));
  const paymentStartsAt = new Date(`${paymentDraft.eventDate}T${paymentDraft.eventTime}:00+07:00`);
  await prisma.$transaction(async (tx) => {
    await tx.templateLicense.deleteMany({ where: { invitationId: paymentInvitationId } });
    await tx.entitlement.deleteMany({ where: { invitationId: paymentInvitationId } });
    await tx.invitation.upsert({
      where: { slug: paymentInvitationSlug },
      update: {
        organizationId: customer.organizationId,
        ownerId: customer.userId,
        createdById: customer.userId,
        resellerOrgId: null,
        templateVersionId: templateVersion.id,
        title: `${paymentDraft.hostOne} & ${paymentDraft.hostTwo}`,
        status: "DRAFT",
        draftData: paymentSnapshot,
        publishedSnapshot: Prisma.DbNull,
        publishedAt: null,
        expiresAt: null,
        deletedAt: null,
      },
      create: {
        id: paymentInvitationId,
        organizationId: customer.organizationId,
        ownerId: customer.userId,
        createdById: customer.userId,
        templateVersionId: templateVersion.id,
        slug: paymentInvitationSlug,
        title: `${paymentDraft.hostOne} & ${paymentDraft.hostTwo}`,
        status: "DRAFT",
        draftData: paymentSnapshot,
      },
    });
    await tx.invitationVersion.deleteMany({ where: { invitationId: paymentInvitationId, version: { gt: 1 } } });
    await tx.invitationVersion.upsert({
      where: { invitationId_version: { invitationId: paymentInvitationId, version: 1 } },
      update: { type: "DRAFT", snapshot: paymentSnapshot, createdById: customer.userId },
      create: { invitationId: paymentInvitationId, version: 1, type: "DRAFT", snapshot: paymentSnapshot, createdById: customer.userId },
    });
    const existingEvent = await tx.event.findFirst({ where: { invitationId: paymentInvitationId }, select: { id: true } });
    if (existingEvent) {
      await tx.event.update({ where: { id: existingEvent.id }, data: { title: `${paymentDraft.hostOne} & ${paymentDraft.hostTwo}`, startsAt: paymentStartsAt, venue: paymentDraft.venue, address: paymentDraft.address, mapsUrl: null } });
    } else {
      await tx.event.create({ data: { invitationId: paymentInvitationId, title: `${paymentDraft.hostOne} & ${paymentDraft.hostTwo}`, startsAt: paymentStartsAt, venue: paymentDraft.venue, address: paymentDraft.address, mapsUrl: null } });
    }
  });

  const resellerOrganization = await prisma.organization.upsert({
    where: { slug: "e2e-reseller" },
    update: { name: "E2E Reseller", type: "RESELLER", status: "ACTIVE" },
    create: { name: "E2E Reseller", slug: "e2e-reseller", type: "RESELLER" },
    select: { id: true },
  });
  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: resellerOrganization.id, userId: customer.userId } },
    update: { role: "OWNER" },
    create: { organizationId: resellerOrganization.id, userId: customer.userId, role: "OWNER" },
  });
  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: resellerOrganization.id, userId: resellerReportOwner.userId } },
    update: { role: "OWNER" },
    create: { organizationId: resellerOrganization.id, userId: resellerReportOwner.userId, role: "OWNER" },
  });
  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: resellerOrganization.id, userId: mobileCustomer.userId } },
    update: { role: "RESELLER_STAFF" },
    create: { organizationId: resellerOrganization.id, userId: mobileCustomer.userId, role: "RESELLER_STAFF" },
  });
  await prisma.resellerProfile.upsert({
    where: { organizationId: resellerOrganization.id },
    update: { status: "APPROVED", businessName: "E2E Reseller", approvedAt: now },
    create: { organizationId: resellerOrganization.id, status: "APPROVED", businessName: "E2E Reseller", approvedAt: now },
  });
  const previousSalesFixtures = await prisma.resellerSale.findMany({
    where: { resellerOrgId: resellerOrganization.id, description: { startsWith: "E2E sales report " } },
    select: { id: true },
  });
  if (previousSalesFixtures.length > 0) {
    await prisma.auditLog.deleteMany({
      where: {
        organizationId: resellerOrganization.id,
        targetType: "ResellerSale",
        targetId: { in: previousSalesFixtures.map(({ id }) => id) },
      },
    });
    await prisma.resellerSale.deleteMany({ where: { id: { in: previousSalesFixtures.map(({ id }) => id) } } });
  }
  const activationResellerOrganization = await prisma.organization.upsert({
    where: { slug: "e2e-activation-reseller" },
    update: { name: "E2E Activation Reseller", type: "RESELLER", status: "ACTIVE" },
    create: { name: "E2E Activation Reseller", slug: "e2e-activation-reseller", type: "RESELLER" },
    select: { id: true },
  });
  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: activationResellerOrganization.id, userId: otherCustomer.userId } },
    update: { role: "OWNER" },
    create: { organizationId: activationResellerOrganization.id, userId: otherCustomer.userId, role: "OWNER" },
  });
  await prisma.resellerProfile.upsert({
    where: { organizationId: activationResellerOrganization.id },
    update: { status: "APPROVED", businessName: "E2E Activation Reseller", approvedAt: now },
    create: { organizationId: activationResellerOrganization.id, status: "APPROVED", businessName: "E2E Activation Reseller", approvedAt: now },
  });
  const refundResellerOrganization = await prisma.organization.upsert({
    where: { slug: "e2e-refund-reseller" },
    update: { name: "E2E Refund Reseller", type: "RESELLER", status: "ACTIVE" },
    create: { name: "E2E Refund Reseller", slug: "e2e-refund-reseller", type: "RESELLER" },
    select: { id: true },
  });
  await prisma.membership.upsert({
    where: { organizationId_userId: { organizationId: refundResellerOrganization.id, userId: refundReseller.userId } },
    update: { role: "OWNER" },
    create: { organizationId: refundResellerOrganization.id, userId: refundReseller.userId, role: "OWNER" },
  });
  await prisma.resellerProfile.upsert({
    where: { organizationId: refundResellerOrganization.id },
    update: { status: "APPROVED", businessName: "E2E Refund Reseller", approvedAt: now },
    create: { organizationId: refundResellerOrganization.id, status: "APPROVED", businessName: "E2E Refund Reseller", approvedAt: now },
  });
  await prisma.creditLedger.upsert({
    where: { resellerOrgId_reference: { resellerOrgId: activationResellerOrganization.id, reference: "e2e-activation-credit-seed" } },
    update: { sku: "PREMIUM_ACTIVATION", type: "TOP_UP", unitsDelta: 3, orderId: null, metadata: { e2eFixture: true } },
    create: { resellerOrgId: activationResellerOrganization.id, sku: "PREMIUM_ACTIVATION", type: "TOP_UP", unitsDelta: 3, reference: "e2e-activation-credit-seed", metadata: { e2eFixture: true } },
  });

  const resellerInvitationFixtures = [
    { id: "10000000-0000-4000-8000-000000000003", slug: "e2e-reseller-desktop", customer, hostOne: "E2E Desktop", hostTwo: "Pelanggan", title: "Undangan reseller desktop" },
    { id: "10000000-0000-4000-8000-000000000004", slug: "e2e-reseller-mobile", customer: mobileCustomer, hostOne: "E2E Mobile", hostTwo: "Pelanggan", title: "Undangan reseller mobile" },
    { id: "10000000-0000-4000-8000-000000000005", slug: "e2e-reseller-webkit", customer: webkitCustomer, hostOne: "E2E WebKit", hostTwo: "Pelanggan", title: "Undangan reseller WebKit" },
  ];
  await prisma.resellerCustomer.deleteMany({
    where: {
      resellerOrgId: activationResellerOrganization.id,
      customerOrgId: { in: resellerInvitationFixtures.map(({ customer }) => customer.organizationId) },
    },
  });
  await prisma.creditLedger.deleteMany({
    where: {
      resellerOrgId: activationResellerOrganization.id,
      type: "ACTIVATION",
      reference: { in: resellerInvitationFixtures.map(({ id }) => `activation:${id}:${templateVersion.id}`) },
    },
  });
  for (const fixture of resellerInvitationFixtures) {
    const draft = {
      ...createInitialDraft(),
      id: fixture.id,
      slug: fixture.slug,
      hostOne: fixture.hostOne,
      hostTwo: fixture.hostTwo,
      eventTitle: fixture.title,
      eventDate: "2030-07-22",
      eventTime: "12:00",
      venue: "Taman Reseller",
      address: "Jl. Aktivasi No. 3, Jakarta",
      story: "Draft milik pelanggan untuk uji aktivasi reseller.",
      templateId: fixtureTemplate.slug,
      templateVersion: fixtureTemplate.version,
      updatedAt: now.toISOString(),
    };
    const snapshot = JSON.parse(JSON.stringify(draft));
    const startsAt = new Date(`${draft.eventDate}T${draft.eventTime}:00+07:00`);
    const invitationTitle = `${draft.hostOne} & ${draft.hostTwo}`;
    await prisma.$transaction(async (tx) => {
      await tx.templateLicense.deleteMany({ where: { invitationId: fixture.id } });
      await tx.entitlement.deleteMany({ where: { invitationId: fixture.id } });
      await tx.invitation.upsert({
        where: { slug: fixture.slug },
        update: {
          organizationId: fixture.customer.organizationId,
          ownerId: fixture.customer.userId,
          createdById: fixture.customer.userId,
          resellerOrgId: null,
          templateVersionId: templateVersion.id,
          title: invitationTitle,
          status: "DRAFT",
          draftData: snapshot,
          publishedSnapshot: Prisma.DbNull,
          publishedAt: null,
          expiresAt: null,
          deletedAt: null,
        },
        create: {
          id: fixture.id,
          organizationId: fixture.customer.organizationId,
          ownerId: fixture.customer.userId,
          createdById: fixture.customer.userId,
          templateVersionId: templateVersion.id,
          slug: fixture.slug,
          title: invitationTitle,
          status: "DRAFT",
          draftData: snapshot,
        },
      });
      await tx.invitationVersion.deleteMany({ where: { invitationId: fixture.id, version: { gt: 1 } } });
      await tx.invitationVersion.upsert({
        where: { invitationId_version: { invitationId: fixture.id, version: 1 } },
        update: { type: "DRAFT", snapshot, createdById: fixture.customer.userId },
        create: { invitationId: fixture.id, version: 1, type: "DRAFT", snapshot, createdById: fixture.customer.userId },
      });
      const existingEvent = await tx.event.findFirst({ where: { invitationId: fixture.id }, select: { id: true } });
      if (existingEvent) {
        await tx.event.update({ where: { id: existingEvent.id }, data: { title: invitationTitle, startsAt, venue: draft.venue, address: draft.address, mapsUrl: null } });
      } else {
        await tx.event.create({ data: { invitationId: fixture.id, title: invitationTitle, startsAt, venue: draft.venue, address: draft.address, mapsUrl: null } });
      }
    });
  }

  async function seedPendingPaymentOrder(input: {
    orderId: string;
    sessionId: string;
    idempotencyKey: string;
    providerSessionId: string;
    organizationId: string;
    buyerId: string;
    invitationId?: string;
    itemType: "TEMPLATE_LICENSE" | "RESELLER_CREDIT";
    sku: string;
    quantity: number;
    unitPriceIdr: number;
    activationPriceIdr?: number;
    templateId?: string;
    templateVersionId?: string;
    entitlementSnapshot: Prisma.InputJsonValue;
  }) {
    const itemTotal = input.unitPriceIdr * input.quantity;
    const activationPriceIdr = input.activationPriceIdr ?? 0;
    const totalAmount = itemTotal + activationPriceIdr;
    await prisma.paymentEvent.deleteMany({ where: { orderId: input.orderId, provider: "XENDIT" } });
    await prisma.creditLedger.deleteMany({ where: { orderId: input.orderId } });
    await prisma.orderItem.deleteMany({ where: { orderId: input.orderId } });
    const order = await prisma.order.upsert({
      where: { idempotencyKey: input.idempotencyKey },
      update: {
        organizationId: input.organizationId,
        buyerId: input.buyerId,
        invitationId: input.invitationId ?? null,
        status: "PENDING",
        currency: "IDR",
        totalAmount,
        priceSnapshot: { e2eFixture: true, item: input.sku, quantity: input.quantity, activationPriceIdr, amountIdr: totalAmount },
        paidAt: null,
      },
      create: {
        id: input.orderId,
        organizationId: input.organizationId,
        buyerId: input.buyerId,
        invitationId: input.invitationId,
        status: "PENDING",
        currency: "IDR",
        totalAmount,
        idempotencyKey: input.idempotencyKey,
        priceSnapshot: { e2eFixture: true, item: input.sku, quantity: input.quantity, activationPriceIdr, amountIdr: totalAmount },
      },
      select: { id: true },
    });
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        itemType: input.itemType,
        sku: input.sku,
        quantity: input.quantity,
        unitPriceIdr: input.unitPriceIdr,
        totalPriceIdr: itemTotal,
        templateId: input.templateId ?? null,
        templateVersionId: input.templateVersionId ?? null,
        entitlementSnapshot: input.entitlementSnapshot,
      },
    });
    if (activationPriceIdr > 0) {
      if (!input.invitationId || input.itemType !== "TEMPLATE_LICENSE" || !input.templateId || !input.templateVersionId) {
        throw new Error("Only a template invitation fixture can include a customer activation item.");
      }
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          itemType: "ACTIVATION",
          sku: `activation:${input.sku.replace(/^template:/, "")}`,
          quantity: 1,
          unitPriceIdr: activationPriceIdr,
          totalPriceIdr: activationPriceIdr,
          templateId: input.templateId,
          templateVersionId: input.templateVersionId,
          entitlementSnapshot: { features: fixtureTemplate.features, licenseType: "PAID_PER_INVITATION", hostingTermDays: 365, templateSlug: fixtureTemplate.slug, templateVersion: fixtureTemplate.version },
        },
      });
    }
    await prisma.notificationJob.deleteMany({ where: { jobKey: `order-paid:${order.id}` } });
    const existingSession = await prisma.paymentSession.findFirst({ where: { orderId: order.id }, select: { id: true } });
    const sessionData = {
      providerSessionId: input.providerSessionId,
      providerPaymentId: null,
      providerPaymentRequestId: null,
      status: "PENDING" as const,
      checkoutUrl: "https://checkout.xendit.co/e2e-fixture",
      amountIdr: totalAmount,
      currency: "IDR",
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
      requestSnapshot: { e2eFixture: true },
      responseSnapshot: Prisma.DbNull,
    };
    if (existingSession) {
      await prisma.paymentSession.update({ where: { id: existingSession.id }, data: sessionData });
    } else {
      await prisma.paymentSession.create({ data: { id: input.sessionId, orderId: order.id, ...sessionData } });
    }
  }

  async function seedPaidResellerRefundFixture(input: {
    orderId: string;
    sessionId: string;
    idempotencyKey: string;
    providerSessionId: string;
    providerPaymentRequestId: string;
    refundId?: string;
    refundReference?: string;
    sku: "BASIC_ACTIVATION" | "PREMIUM_ACTIVATION";
    units: number;
    unitPriceIdr: number;
  }) {
    const totalAmount = input.units * input.unitPriceIdr;
    const refundReference = input.refundId ? `refund:${input.refundId}` : null;
    const failedRefundReference = input.refundId ? `refund-failed:${input.refundId}` : null;
    await prisma.$transaction(async (tx) => {
      await tx.paymentEvent.deleteMany({ where: { orderId: input.orderId } });
      await tx.refund.deleteMany({ where: { orderId: input.orderId } });
      await tx.creditLedger.deleteMany({ where: { resellerOrgId: refundResellerOrganization.id, orderId: input.orderId, type: { not: "TOP_UP" } } });
      await tx.creditLedger.deleteMany({ where: { resellerOrgId: refundResellerOrganization.id, orderId: input.orderId, type: "TOP_UP" } });
      if (failedRefundReference) await tx.creditLedger.deleteMany({ where: { resellerOrgId: refundResellerOrganization.id, reference: failedRefundReference } });
      await tx.orderItem.deleteMany({ where: { orderId: input.orderId } });
      const order = await tx.order.upsert({
        where: { idempotencyKey: input.idempotencyKey },
        update: {
          organizationId: refundResellerOrganization.id,
          buyerId: refundReseller.userId,
          invitationId: null,
          status: "PAID",
          currency: "IDR",
          totalAmount,
          priceSnapshot: { e2eFixture: true, flow: "REFUND_CALLBACK", sku: input.sku, quantity: input.units },
          paidAt: now,
          canceledAt: null,
        },
        create: {
          id: input.orderId,
          organizationId: refundResellerOrganization.id,
          buyerId: refundReseller.userId,
          status: "PAID",
          currency: "IDR",
          totalAmount,
          idempotencyKey: input.idempotencyKey,
          priceSnapshot: { e2eFixture: true, flow: "REFUND_CALLBACK", sku: input.sku, quantity: input.units },
          paidAt: now,
        },
        select: { id: true },
      });
      const item = await tx.orderItem.create({
        data: {
          orderId: order.id,
          itemType: "RESELLER_CREDIT",
          sku: `credit:${input.sku}`,
          quantity: input.units,
          unitPriceIdr: input.unitPriceIdr,
          totalPriceIdr: totalAmount,
          entitlementSnapshot: { creditSku: input.sku, units: input.units },
        },
        select: { id: true },
      });
      const sessionData = {
        providerSessionId: input.providerSessionId,
        providerPaymentId: `${input.providerPaymentRequestId}-payment`,
        providerPaymentRequestId: input.providerPaymentRequestId,
        status: "SUCCEEDED" as const,
        checkoutUrl: "https://checkout.xendit.co/e2e-fixture",
        amountIdr: totalAmount,
        currency: "IDR",
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
        requestSnapshot: { e2eFixture: true },
        responseSnapshot: Prisma.DbNull,
      };
      const existingSession = await tx.paymentSession.findFirst({ where: { orderId: order.id }, select: { id: true } });
      const session = existingSession
        ? await tx.paymentSession.update({ where: { id: existingSession.id }, data: sessionData, select: { id: true } })
        : await tx.paymentSession.create({ data: { id: input.sessionId, orderId: order.id, ...sessionData }, select: { id: true } });

      const topUp = await tx.creditLedger.create({
        data: {
          resellerOrgId: refundResellerOrganization.id,
          orderId: order.id,
          sku: input.sku,
          type: "TOP_UP",
          unitsDelta: input.units,
          reference: `order:${order.id}:item:${item.id}`,
          metadata: { orderItemId: item.id, e2eFixture: true },
        },
        select: { id: true },
      });
      if (input.refundId && input.refundReference && refundReference) {
        await tx.creditLedger.create({
          data: {
            resellerOrgId: refundResellerOrganization.id,
            orderId: order.id,
            sourceTopUpId: topUp.id,
            sku: input.sku,
            type: "REFUND",
            unitsDelta: -input.units,
            reference: refundReference,
            metadata: { refundId: input.refundId, reserved: true, e2eFixture: true },
          },
        });
        await tx.refund.create({
          data: {
            id: input.refundId,
            orderId: order.id,
            paymentSessionId: session.id,
            requestedById: refundReseller.userId,
            referenceId: input.refundReference,
            amount: totalAmount,
            currency: "IDR",
            reason: "REQUESTED_BY_CUSTOMER",
            status: "PENDING",
            requestSnapshot: { resellerCreditSku: input.sku, resellerCreditUnits: input.units },
            responseSnapshot: Prisma.DbNull,
          },
        });
      }
    });
  }

  await seedPendingPaymentOrder({
    orderId: "20000000-0000-4000-8000-000000000001",
    sessionId: "30000000-0000-4000-8000-000000000001",
    idempotencyKey: "e2e-template-payment-order",
    providerSessionId: "e2e-template-payment-session",
    organizationId: customer.organizationId,
    buyerId: customer.userId,
    invitationId: paymentInvitationId,
    itemType: "TEMPLATE_LICENSE",
    sku: `template:${fixtureTemplate.slug}@${fixtureTemplate.version}`,
    quantity: 1,
    unitPriceIdr: fixtureTemplate.price,
    activationPriceIdr: 25_000,
    templateId: template.id,
    templateVersionId: templateVersion.id,
    entitlementSnapshot: { features: fixtureTemplate.features, licenseType: "PAID_PER_INVITATION", hostingTermDays: 365, templateSlug: fixtureTemplate.slug, templateVersion: fixtureTemplate.version },
  });
  await seedPendingPaymentOrder({
    orderId: "20000000-0000-4000-8000-000000000002",
    sessionId: "30000000-0000-4000-8000-000000000002",
    idempotencyKey: "e2e-reseller-top-up-order",
    providerSessionId: "e2e-reseller-top-up-session",
    organizationId: resellerOrganization.id,
    buyerId: customer.userId,
    itemType: "RESELLER_CREDIT",
    sku: "credit:PREMIUM_ACTIVATION",
    quantity: 2,
    unitPriceIdr: 50_000,
    entitlementSnapshot: { creditSku: "PREMIUM_ACTIVATION", units: 2 },
  });
  await seedPendingPaymentOrder({
    orderId: "20000000-0000-4000-8000-000000000003",
    sessionId: "30000000-0000-4000-8000-000000000003",
    idempotencyKey: "e2e-expired-reseller-top-up-order",
    providerSessionId: "e2e-expired-reseller-top-up-session",
    organizationId: resellerOrganization.id,
    buyerId: customer.userId,
    itemType: "RESELLER_CREDIT",
    sku: "credit:BASIC_ACTIVATION",
    quantity: 2,
    unitPriceIdr: 20_000,
    entitlementSnapshot: { creditSku: "BASIC_ACTIVATION", units: 2 },
  });
  await seedPaidResellerRefundFixture({
    orderId: "20000000-0000-4000-8000-000000000004",
    sessionId: "30000000-0000-4000-8000-000000000004",
    idempotencyKey: "e2e-successful-refund-order",
    providerSessionId: "e2e-successful-refund-session",
    providerPaymentRequestId: "e2e-successful-refund-payment-request",
    refundId: "40000000-0000-4000-8000-000000000001",
    refundReference: "e2e-successful-refund-reference",
    sku: "PREMIUM_ACTIVATION",
    units: 2,
    unitPriceIdr: 50_000,
  });
  await seedPaidResellerRefundFixture({
    orderId: "20000000-0000-4000-8000-000000000005",
    sessionId: "30000000-0000-4000-8000-000000000005",
    idempotencyKey: "e2e-failed-refund-order",
    providerSessionId: "e2e-failed-refund-session",
    providerPaymentRequestId: "e2e-failed-refund-payment-request",
    refundId: "40000000-0000-4000-8000-000000000002",
    refundReference: "e2e-failed-refund-reference",
    sku: "BASIC_ACTIVATION",
    units: 1,
    unitPriceIdr: 20_000,
  });
  await prisma.creditLedger.deleteMany({
    where: {
      resellerOrgId: refundResellerOrganization.id,
      reference: { in: ["e2e-credit-lot-activation-later", "e2e-credit-lot-activation-same-lot"] },
    },
  });
  await seedPaidResellerRefundFixture({
    orderId: "20000000-0000-4000-8000-000000000006",
    sessionId: "30000000-0000-4000-8000-000000000006",
    idempotencyKey: "e2e-refund-credit-lot-order",
    providerSessionId: "e2e-refund-credit-lot-session",
    providerPaymentRequestId: "e2e-refund-credit-lot-payment-request",
    sku: "PREMIUM_ACTIVATION",
    units: 2,
    unitPriceIdr: 50_000,
  });
  await seedPaidResellerRefundFixture({
    orderId: "20000000-0000-4000-8000-000000000007",
    sessionId: "30000000-0000-4000-8000-000000000007",
    idempotencyKey: "e2e-refund-credit-lot-later-order",
    providerSessionId: "e2e-refund-credit-lot-later-session",
    providerPaymentRequestId: "e2e-refund-credit-lot-later-payment-request",
    sku: "PREMIUM_ACTIVATION",
    units: 1,
    unitPriceIdr: 50_000,
  });
  await seedPaidResellerRefundFixture({
    orderId: "20000000-0000-4000-8000-000000000008",
    sessionId: "30000000-0000-4000-8000-000000000008",
    idempotencyKey: "e2e-refund-credit-lot-used-order",
    providerSessionId: "e2e-refund-credit-lot-used-session",
    providerPaymentRequestId: "e2e-refund-credit-lot-used-payment-request",
    sku: "PREMIUM_ACTIVATION",
    units: 1,
    unitPriceIdr: 50_000,
  });
  const laterTopUp = await prisma.creditLedger.findFirst({
    where: { resellerOrgId: refundResellerOrganization.id, orderId: "20000000-0000-4000-8000-000000000007", type: "TOP_UP" },
    select: { id: true },
  });
  const usedTopUp = await prisma.creditLedger.findFirst({
    where: { resellerOrgId: refundResellerOrganization.id, orderId: "20000000-0000-4000-8000-000000000008", type: "TOP_UP" },
    select: { id: true },
  });
  if (!laterTopUp || !usedTopUp) throw new Error("Credit lot fixtures are missing their top-up ledger entries.");
  await prisma.creditLedger.createMany({
    data: [
      { resellerOrgId: refundResellerOrganization.id, sku: "PREMIUM_ACTIVATION", type: "ACTIVATION", unitsDelta: -1, sourceTopUpId: laterTopUp.id, reference: "e2e-credit-lot-activation-later", metadata: { invitationId: "e2e-credit-lot-later-invitation", e2eFixture: true } },
      { resellerOrgId: refundResellerOrganization.id, sku: "PREMIUM_ACTIVATION", type: "ACTIVATION", unitsDelta: -1, sourceTopUpId: usedTopUp.id, reference: "e2e-credit-lot-activation-same-lot", metadata: { invitationId: "e2e-credit-lot-used-invitation", e2eFixture: true } },
    ],
  });

  process.stdout.write("E2E accounts, invitations, reseller, template-review, and payment-lifecycle fixtures seeded.\n");
} finally {
  await prisma.$disconnect();
}
}

void seedE2eFixtures().catch((error: unknown) => {
  const detail = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${detail}\n`);
  process.exitCode = 1;
});
