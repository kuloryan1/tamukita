ALTER TABLE "paparazzi_photos" ADD COLUMN "storyKey" TEXT;

CREATE UNIQUE INDEX "paparazzi_photos_storyKey_key" ON "paparazzi_photos"("storyKey");
