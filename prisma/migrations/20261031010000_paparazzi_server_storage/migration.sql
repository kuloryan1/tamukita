-- Keep existing photos in R2. New reservations explicitly select their storage provider.
CREATE TYPE "PaparazziStorageProvider" AS ENUM ('R2', 'SERVER');
ALTER TABLE "paparazzi_photos" ADD COLUMN "storageProvider" "PaparazziStorageProvider" NOT NULL DEFAULT 'R2';

-- Event testing accepts any number of photos; disk capacity and per-file checks still apply.
ALTER TABLE "paparazzi_albums" ALTER COLUMN "maxPhotos" DROP DEFAULT;
ALTER TABLE "paparazzi_albums" ALTER COLUMN "maxPhotos" DROP NOT NULL;
UPDATE "paparazzi_albums" SET "maxPhotos" = NULL;
