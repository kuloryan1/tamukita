-- Preserve existing assets in R2; new invitation uploads use persistent server storage.
CREATE TYPE "MediaStorageProvider" AS ENUM ('R2', 'SERVER');
ALTER TABLE "media_assets" ADD COLUMN "storageProvider" "MediaStorageProvider" NOT NULL DEFAULT 'R2';
