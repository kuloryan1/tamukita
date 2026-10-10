ALTER TABLE "payment_sessions" ADD COLUMN "providerPaymentRequestId" TEXT;
CREATE UNIQUE INDEX "payment_sessions_providerPaymentRequestId_key" ON "payment_sessions"("providerPaymentRequestId");

CREATE TYPE "RefundStatus" AS ENUM ('INITIATING', 'PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "RefundReason" AS ENUM ('FRAUDULENT', 'DUPLICATE', 'REQUESTED_BY_CUSTOMER', 'CANCELLATION', 'OTHERS');

CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paymentSessionId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "providerRefundId" TEXT,
    "referenceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "reason" "RefundReason" NOT NULL,
    "adminNote" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'INITIATING',
    "failureCode" TEXT,
    "requestSnapshot" JSONB,
    "responseSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refunds_providerRefundId_key" ON "refunds"("providerRefundId");
CREATE UNIQUE INDEX "refunds_referenceId_key" ON "refunds"("referenceId");
CREATE INDEX "refunds_orderId_status_createdAt_idx" ON "refunds"("orderId", "status", "createdAt");

ALTER TABLE "refunds" ADD CONSTRAINT "refunds_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_paymentSessionId_fkey"
    FOREIGN KEY ("paymentSessionId") REFERENCES "payment_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
