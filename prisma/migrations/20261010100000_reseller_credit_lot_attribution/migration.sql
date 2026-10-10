ALTER TABLE "credit_ledger"
ADD COLUMN "sourceTopUpId" UUID;

UPDATE "credit_ledger" AS refund_entry
SET "sourceTopUpId" = top_up.id
FROM "credit_ledger" AS top_up
WHERE refund_entry."sourceTopUpId" IS NULL
  AND refund_entry."type" = 'REFUND'
  AND refund_entry."orderId" = top_up."orderId"
  AND refund_entry."resellerOrgId" = top_up."resellerOrgId"
  AND refund_entry."sku" = top_up."sku"
  AND top_up."type" = 'TOP_UP';

UPDATE "credit_ledger" AS restore_entry
SET "sourceTopUpId" = top_up.id
FROM "refunds" AS refund
JOIN "credit_ledger" AS top_up
  ON top_up."orderId" = refund."orderId"
 AND top_up."type" = 'TOP_UP'
WHERE restore_entry."sourceTopUpId" IS NULL
  AND restore_entry."type" = 'ADJUSTMENT'
  AND restore_entry."metadata"->>'refundId' = refund.id::text
  AND restore_entry."resellerOrgId" = top_up."resellerOrgId"
  AND restore_entry."sku" = top_up."sku";

ALTER TABLE "credit_ledger"
ADD CONSTRAINT "credit_ledger_sourceTopUpId_fkey"
FOREIGN KEY ("sourceTopUpId") REFERENCES "credit_ledger"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "credit_ledger_sourceTopUpId_idx" ON "credit_ledger"("sourceTopUpId");
