ALTER TABLE "users"
  ADD COLUMN "adultAttestedAt" TIMESTAMP(3),
  ADD COLUMN "adultAttestationVersion" VARCHAR(40);

ALTER TABLE "users"
  ADD CONSTRAINT "users_adult_attestation_pair_check"
  CHECK (("adultAttestedAt" IS NULL) = ("adultAttestationVersion" IS NULL));

ALTER TABLE "rsvps"
  ADD COLUMN "includesChildData" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "guardianConsentAt" TIMESTAMP(3),
  ADD COLUMN "guardianConsentVersion" VARCHAR(40);

ALTER TABLE "rsvps"
  ADD CONSTRAINT "rsvps_guardian_consent_check"
  CHECK (
    ("includesChildData" = false AND "guardianConsentAt" IS NULL AND "guardianConsentVersion" IS NULL)
    OR ("includesChildData" = true AND "guardianConsentAt" IS NOT NULL AND "guardianConsentVersion" IS NOT NULL)
  );

ALTER TABLE "guestbook"
  ADD COLUMN "includesChildData" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "guardianConsentAt" TIMESTAMP(3),
  ADD COLUMN "guardianConsentVersion" VARCHAR(40);

ALTER TABLE "guestbook"
  ADD CONSTRAINT "guestbook_guardian_consent_check"
  CHECK (
    ("includesChildData" = false AND "guardianConsentAt" IS NULL AND "guardianConsentVersion" IS NULL)
    OR ("includesChildData" = true AND "guardianConsentAt" IS NOT NULL AND "guardianConsentVersion" IS NOT NULL)
  );
