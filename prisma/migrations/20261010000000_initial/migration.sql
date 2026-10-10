-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('CUSTOMER', 'SUPER_ADMIN', 'FINANCE', 'SUPPORT', 'CONTENT_REVIEWER', 'TEMPLATE_DEVELOPER');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('PERSONAL', 'RESELLER', 'PLATFORM');

-- CreateEnum
CREATE TYPE "OrganizationStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'RESELLER_STAFF');

-- CreateEnum
CREATE TYPE "TemplateStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TemplateLicenseType" AS ENUM ('FREE', 'PAID_PER_INVITATION');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED', 'EXPIRED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "InvitationVersionType" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "MediaVisibility" AS ENUM ('PRIVATE_SOURCE', 'PUBLIC_VARIANT');

-- CreateEnum
CREATE TYPE "GuestAttendance" AS ENUM ('ATTENDING', 'DECLINED', 'MAYBE');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'CANCELED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "OrderItemType" AS ENUM ('TEMPLATE_LICENSE', 'ACTIVATION', 'RENEWAL', 'RESELLER_CREDIT');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('XENDIT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ResellerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CreditSku" AS ENUM ('BASIC_ACTIVATION', 'PREMIUM_ACTIVATION');

-- CreateEnum
CREATE TYPE "CreditLedgerType" AS ENUM ('TOP_UP', 'ACTIVATION', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "EntitlementStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "platformRole" "PlatformRole" NOT NULL DEFAULT 'CUSTOMER',
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'PERSONAL',
    "status" "OrganizationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "licenseType" "TemplateLicenseType" NOT NULL DEFAULT 'FREE',
    "priceIdr" INTEGER NOT NULL DEFAULT 0,
    "status" "TemplateStatus" NOT NULL DEFAULT 'DRAFT',
    "authorId" UUID,
    "activeVersionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_versions" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "sdkVersion" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "sourceRef" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitations" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "resellerOrgId" UUID,
    "templateVersionId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "InvitationStatus" NOT NULL DEFAULT 'DRAFT',
    "draftData" JSONB NOT NULL,
    "publishedSnapshot" JSONB,
    "publishedAt" TIMESTAMP(3),
    "startsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation_versions" (
    "id" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "type" "InvitationVersionType" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "venue" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "mapsUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "invitationId" UUID,
    "uploadedById" UUID NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "visibility" "MediaVisibility" NOT NULL DEFAULT 'PRIVATE_SOURCE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_variants" (
    "id" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "variantKey" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_edits" (
    "id" UUID NOT NULL,
    "mediaAssetId" UUID NOT NULL,
    "revision" INTEGER NOT NULL,
    "editData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guests" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phoneCiphertext" BYTEA,
    "emailCiphertext" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_links" (
    "id" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rsvps" (
    "id" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "eventId" UUID,
    "guestId" UUID,
    "displayName" TEXT NOT NULL,
    "attendance" "GuestAttendance" NOT NULL,
    "attendeeCount" INTEGER NOT NULL DEFAULT 1,
    "message" TEXT,
    "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guestbook" (
    "id" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "guestId" UUID,
    "displayName" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "guestbook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "invitationId" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT NOT NULL,
    "priceSnapshot" JSONB NOT NULL,
    "paidAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "itemType" "OrderItemType" NOT NULL,
    "sku" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPriceIdr" INTEGER NOT NULL,
    "totalPriceIdr" INTEGER NOT NULL,
    "templateId" UUID,
    "templateVersionId" UUID,
    "entitlementSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_sessions" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'XENDIT',
    "providerSessionId" TEXT,
    "providerPaymentId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "checkoutUrl" TEXT,
    "amountIdr" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "expiresAt" TIMESTAMP(3),
    "requestSnapshot" JSONB,
    "responseSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_events" (
    "id" UUID NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'XENDIT',
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "paymentSessionId" UUID,
    "orderId" UUID,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_licenses" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "templateVersionId" UUID NOT NULL,
    "orderId" UUID,
    "orderItemId" UUID,
    "licenseSnapshot" JSONB NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "template_licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceIdr" INTEGER NOT NULL DEFAULT 0,
    "durationDays" INTEGER NOT NULL DEFAULT 365,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_entitlements" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "featureKey" TEXT NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "plan_entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entitlements" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "invitationId" UUID,
    "planId" UUID,
    "orderId" UUID,
    "featureKey" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "status" "EntitlementStatus" NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entitlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_profiles" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "status" "ResellerStatus" NOT NULL DEFAULT 'PENDING',
    "businessName" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reseller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_customers" (
    "id" UUID NOT NULL,
    "resellerOrgId" UUID NOT NULL,
    "customerOrgId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reseller_customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_ledger" (
    "id" UUID NOT NULL,
    "resellerOrgId" UUID NOT NULL,
    "orderId" UUID,
    "sku" "CreditSku" NOT NULL,
    "type" "CreditLedgerType" NOT NULL,
    "unitsDelta" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_jobs" (
    "id" UUID NOT NULL,
    "jobKey" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricValue" BIGINT NOT NULL DEFAULT 0,
    "dimensions" JSONB,

    CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" VARCHAR(64) NOT NULL,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_platformRole_idx" ON "users"("platformRole");

-- CreateIndex
CREATE INDEX "accounts_userId_idx" ON "accounts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "organizations_type_status_idx" ON "organizations"("type", "status");

-- CreateIndex
CREATE INDEX "memberships_userId_role_idx" ON "memberships"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organizationId_userId_key" ON "memberships"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "templates_slug_key" ON "templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "templates_activeVersionId_key" ON "templates"("activeVersionId");

-- CreateIndex
CREATE INDEX "templates_status_category_idx" ON "templates"("status", "category");

-- CreateIndex
CREATE INDEX "template_versions_templateId_publishedAt_idx" ON "template_versions"("templateId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "template_versions_templateId_version_key" ON "template_versions"("templateId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "invitations_slug_key" ON "invitations"("slug");

-- CreateIndex
CREATE INDEX "invitations_organizationId_status_updatedAt_idx" ON "invitations"("organizationId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "invitations_ownerId_status_idx" ON "invitations"("ownerId", "status");

-- CreateIndex
CREATE INDEX "invitations_resellerOrgId_createdAt_idx" ON "invitations"("resellerOrgId", "createdAt");

-- CreateIndex
CREATE INDEX "invitation_versions_invitationId_type_createdAt_idx" ON "invitation_versions"("invitationId", "type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_versions_invitationId_version_key" ON "invitation_versions"("invitationId", "version");

-- CreateIndex
CREATE INDEX "events_invitationId_startsAt_idx" ON "events"("invitationId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_storageKey_key" ON "media_assets"("storageKey");

-- CreateIndex
CREATE INDEX "media_assets_organizationId_createdAt_idx" ON "media_assets"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "media_assets_invitationId_status_idx" ON "media_assets"("invitationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_storageKey_key" ON "media_variants"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "media_variants_mediaAssetId_variantKey_key" ON "media_variants"("mediaAssetId", "variantKey");

-- CreateIndex
CREATE UNIQUE INDEX "media_edits_mediaAssetId_revision_key" ON "media_edits"("mediaAssetId", "revision");

-- CreateIndex
CREATE INDEX "guests_organizationId_name_idx" ON "guests"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "guest_links_tokenHash_key" ON "guest_links"("tokenHash");

-- CreateIndex
CREATE INDEX "guest_links_invitationId_createdAt_idx" ON "guest_links"("invitationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "guest_links_invitationId_guestId_key" ON "guest_links"("invitationId", "guestId");

-- CreateIndex
CREATE INDEX "rsvps_invitationId_respondedAt_idx" ON "rsvps"("invitationId", "respondedAt");

-- CreateIndex
CREATE INDEX "rsvps_guestId_idx" ON "rsvps"("guestId");

-- CreateIndex
CREATE INDEX "guestbook_invitationId_status_createdAt_idx" ON "guestbook"("invitationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "orders_organizationId_status_createdAt_idx" ON "orders"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "orders_buyerId_createdAt_idx" ON "orders"("buyerId", "createdAt");

-- CreateIndex
CREATE INDEX "order_items_orderId_itemType_idx" ON "order_items"("orderId", "itemType");

-- CreateIndex
CREATE UNIQUE INDEX "payment_sessions_providerSessionId_key" ON "payment_sessions"("providerSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_sessions_providerPaymentId_key" ON "payment_sessions"("providerPaymentId");

-- CreateIndex
CREATE INDEX "payment_sessions_orderId_status_idx" ON "payment_sessions"("orderId", "status");

-- CreateIndex
CREATE INDEX "payment_events_processedAt_receivedAt_idx" ON "payment_events"("processedAt", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_events_provider_providerEventId_key" ON "payment_events"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "template_licenses_organizationId_purchasedAt_idx" ON "template_licenses"("organizationId", "purchasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "template_licenses_invitationId_templateVersionId_key" ON "template_licenses"("invitationId", "templateVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "plans_key_key" ON "plans"("key");

-- CreateIndex
CREATE UNIQUE INDEX "plan_entitlements_planId_featureKey_key" ON "plan_entitlements"("planId", "featureKey");

-- CreateIndex
CREATE INDEX "entitlements_organizationId_featureKey_status_idx" ON "entitlements"("organizationId", "featureKey", "status");

-- CreateIndex
CREATE INDEX "entitlements_invitationId_expiresAt_idx" ON "entitlements"("invitationId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "reseller_profiles_organizationId_key" ON "reseller_profiles"("organizationId");

-- CreateIndex
CREATE INDEX "reseller_customers_customerOrgId_idx" ON "reseller_customers"("customerOrgId");

-- CreateIndex
CREATE UNIQUE INDEX "reseller_customers_resellerOrgId_customerOrgId_key" ON "reseller_customers"("resellerOrgId", "customerOrgId");

-- CreateIndex
CREATE INDEX "credit_ledger_resellerOrgId_sku_createdAt_idx" ON "credit_ledger"("resellerOrgId", "sku", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "credit_ledger_resellerOrgId_reference_key" ON "credit_ledger"("resellerOrgId", "reference");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "notification_jobs_jobKey_key" ON "notification_jobs"("jobKey");

-- CreateIndex
CREATE INDEX "notification_jobs_completedAt_failedAt_availableAt_idx" ON "notification_jobs"("completedAt", "failedAt", "availableAt");

-- CreateIndex
CREATE INDEX "analytics_daily_date_metricKey_idx" ON "analytics_daily"("date", "metricKey");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_organizationId_date_metricKey_key" ON "analytics_daily"("organizationId", "date", "metricKey");

-- CreateIndex
CREATE INDEX "rate_limit_buckets_windowStartedAt_idx" ON "rate_limit_buckets"("windowStartedAt");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_resellerOrgId_fkey" FOREIGN KEY ("resellerOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_versions" ADD CONSTRAINT "invitation_versions_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation_versions" ADD CONSTRAINT "invitation_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_variants" ADD CONSTRAINT "media_variants_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_edits" ADD CONSTRAINT "media_edits_mediaAssetId_fkey" FOREIGN KEY ("mediaAssetId") REFERENCES "media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guests" ADD CONSTRAINT "guests_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_links" ADD CONSTRAINT "guest_links_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_links" ADD CONSTRAINT "guest_links_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guestbook" ADD CONSTRAINT "guestbook_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guestbook" ADD CONSTRAINT "guestbook_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "template_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_sessions" ADD CONSTRAINT "payment_sessions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_paymentSessionId_fkey" FOREIGN KEY ("paymentSessionId") REFERENCES "payment_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_licenses" ADD CONSTRAINT "template_licenses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_licenses" ADD CONSTRAINT "template_licenses_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_licenses" ADD CONSTRAINT "template_licenses_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_licenses" ADD CONSTRAINT "template_licenses_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_licenses" ADD CONSTRAINT "template_licenses_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_licenses" ADD CONSTRAINT "template_licenses_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "order_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_entitlements" ADD CONSTRAINT "plan_entitlements_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entitlements" ADD CONSTRAINT "entitlements_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_profiles" ADD CONSTRAINT "reseller_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_customers" ADD CONSTRAINT "reseller_customers_resellerOrgId_fkey" FOREIGN KEY ("resellerOrgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_customers" ADD CONSTRAINT "reseller_customers_customerOrgId_fkey" FOREIGN KEY ("customerOrgId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_resellerOrgId_fkey" FOREIGN KEY ("resellerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_ledger" ADD CONSTRAINT "credit_ledger_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

