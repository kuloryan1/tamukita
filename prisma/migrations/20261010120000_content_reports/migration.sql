ALTER TYPE "ModerationStatus" ADD VALUE 'HIDDEN';

CREATE TYPE "ContentReportStatus" AS ENUM ('PENDING', 'DISMISSED', 'HIDDEN', 'RESTORED');
CREATE TYPE "ContentReportReason" AS ENUM ('SPAM', 'HARASSMENT', 'PERSONAL_INFORMATION', 'OTHER');

CREATE TABLE "content_reports" (
    "id" UUID NOT NULL,
    "guestbookEntryId" UUID NOT NULL,
    "reporterFingerprint" VARCHAR(64) NOT NULL,
    "reason" "ContentReportReason" NOT NULL,
    "status" "ContentReportStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "content_reports_guestbookEntryId_reporterFingerprint_key" ON "content_reports"("guestbookEntryId", "reporterFingerprint");
CREATE INDEX "content_reports_status_createdAt_idx" ON "content_reports"("status", "createdAt");
CREATE INDEX "content_reports_guestbookEntryId_status_idx" ON "content_reports"("guestbookEntryId", "status");

ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_guestbookEntryId_fkey" FOREIGN KEY ("guestbookEntryId") REFERENCES "guestbook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
