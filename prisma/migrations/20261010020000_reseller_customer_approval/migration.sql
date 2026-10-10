CREATE TYPE "ResellerCustomerStatus" AS ENUM ('PENDING', 'ACTIVE', 'DECLINED', 'REVOKED');

ALTER TABLE "reseller_customers"
ADD COLUMN "status" "ResellerCustomerStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "approvedAt" TIMESTAMP(3);
