CREATE TABLE "reseller_sales" (
    "id" UUID NOT NULL,
    "resellerOrgId" UUID NOT NULL,
    "customerOrgId" UUID,
    "invitationId" UUID,
    "recordedById" UUID,
    "amountIdr" INTEGER NOT NULL,
    "description" VARCHAR(160) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidReason" VARCHAR(240),
    "voidedById" UUID,

    CONSTRAINT "reseller_sales_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "reseller_sales_amountIdr_check" CHECK ("amountIdr" > 0)
);

CREATE INDEX "reseller_sales_resellerOrgId_createdAt_idx" ON "reseller_sales"("resellerOrgId", "createdAt");
CREATE INDEX "reseller_sales_customerOrgId_createdAt_idx" ON "reseller_sales"("customerOrgId", "createdAt");
CREATE INDEX "reseller_sales_invitationId_idx" ON "reseller_sales"("invitationId");

ALTER TABLE "reseller_sales" ADD CONSTRAINT "reseller_sales_resellerOrgId_fkey"
    FOREIGN KEY ("resellerOrgId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reseller_sales" ADD CONSTRAINT "reseller_sales_customerOrgId_fkey"
    FOREIGN KEY ("customerOrgId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reseller_sales" ADD CONSTRAINT "reseller_sales_invitationId_fkey"
    FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reseller_sales" ADD CONSTRAINT "reseller_sales_recordedById_fkey"
    FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reseller_sales" ADD CONSTRAINT "reseller_sales_voidedById_fkey"
    FOREIGN KEY ("voidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
