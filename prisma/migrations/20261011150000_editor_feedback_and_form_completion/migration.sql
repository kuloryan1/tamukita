CREATE TYPE "EditorFeedbackCategory" AS ENUM (
    'FORM',
    'AUTOSAVE',
    'PHOTO',
    'TEMPLATE',
    'PREVIEW',
    'PUBLISH',
    'OTHER'
);

CREATE TYPE "EditorFeedbackStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED');

ALTER TABLE "invitations" ADD COLUMN "formCompletedAt" TIMESTAMP(3);

UPDATE "invitations" AS invitation
SET "formCompletedAt" = COALESCE(
    invitation."publishedAt",
    (SELECT MIN("createdAt") FROM "orders" WHERE "invitationId" = invitation."id")
)
WHERE invitation."publishedAt" IS NOT NULL
   OR EXISTS (SELECT 1 FROM "orders" WHERE "invitationId" = invitation."id");

CREATE TABLE "editor_feedback" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "invitationId" UUID,
    "category" "EditorFeedbackCategory" NOT NULL,
    "message" VARCHAR(1200) NOT NULL,
    "status" "EditorFeedbackStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "editor_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invitations_createdAt_formCompletedAt_idx" ON "invitations"("createdAt", "formCompletedAt");
CREATE INDEX "editor_feedback_status_createdAt_idx" ON "editor_feedback"("status", "createdAt");
CREATE INDEX "editor_feedback_userId_createdAt_idx" ON "editor_feedback"("userId", "createdAt");
CREATE INDEX "editor_feedback_organizationId_createdAt_idx" ON "editor_feedback"("organizationId", "createdAt");

ALTER TABLE "editor_feedback" ADD CONSTRAINT "editor_feedback_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "editor_feedback" ADD CONSTRAINT "editor_feedback_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "editor_feedback" ADD CONSTRAINT "editor_feedback_invitationId_fkey"
    FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
