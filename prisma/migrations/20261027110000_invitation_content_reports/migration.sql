CREATE TYPE "InvitationReportReason" AS ENUM (
  'CHILD_SAFETY',
  'PERSONAL_INFORMATION',
  'COPYRIGHT',
  'IMPERSONATION',
  'SPAM',
  'OTHER'
);

CREATE TABLE "invitation_reports" (
  "id" UUID NOT NULL,
  "invitationId" UUID NOT NULL,
  "reporterFingerprint" VARCHAR(64) NOT NULL,
  "reason" "InvitationReportReason" NOT NULL,
  "status" "ContentReportStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "invitation_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invitation_reports_invitationId_reporterFingerprint_key"
  ON "invitation_reports"("invitationId", "reporterFingerprint");
CREATE INDEX "invitation_reports_status_createdAt_idx"
  ON "invitation_reports"("status", "createdAt");
CREATE INDEX "invitation_reports_invitationId_status_idx"
  ON "invitation_reports"("invitationId", "status");

ALTER TABLE "invitation_reports"
  ADD CONSTRAINT "invitation_reports_invitationId_fkey"
  FOREIGN KEY ("invitationId") REFERENCES "invitations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
