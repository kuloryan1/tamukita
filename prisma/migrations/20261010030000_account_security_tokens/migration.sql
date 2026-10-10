-- Existing accounts predate mandatory email confirmation. Treat them as verified;
-- every account registered after this migration must complete email verification.
ALTER TABLE "users" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;
UPDATE "users" SET "emailVerified" = "createdAt" WHERE "email" IS NOT NULL AND "emailVerified" IS NULL;

CREATE TYPE "AccountTokenPurpose" AS ENUM ('VERIFY_EMAIL', 'PASSWORD_RESET');

CREATE TABLE "account_tokens" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "AccountTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "account_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_tokens_tokenHash_key" ON "account_tokens"("tokenHash");
CREATE INDEX "account_tokens_userId_purpose_consumedAt_idx" ON "account_tokens"("userId", "purpose", "consumedAt");
CREATE INDEX "account_tokens_expiresAt_idx" ON "account_tokens"("expiresAt");

ALTER TABLE "account_tokens" ADD CONSTRAINT "account_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
