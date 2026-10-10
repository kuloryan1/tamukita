CREATE TABLE "support_access_grants" (
    "id" UUID NOT NULL,
    "adminId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_access_grants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "support_access_grants_adminId_expiresAt_revokedAt_idx" ON "support_access_grants"("adminId", "expiresAt", "revokedAt");
CREATE INDEX "support_access_grants_invitationId_createdAt_idx" ON "support_access_grants"("invitationId", "createdAt");

ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "support_access_grants" ADD CONSTRAINT "support_access_grants_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
