ALTER TYPE "MediaStatus" ADD VALUE 'PROCESSING';

ALTER TABLE "media_assets" ADD COLUMN "processingStartedAt" TIMESTAMP(3);
