ALTER TABLE "paparazzi_photos"
  ALTER COLUMN "consentAt" DROP NOT NULL,
  ALTER COLUMN "consentVersion" DROP NOT NULL;
