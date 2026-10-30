-- CreateTable
CREATE TABLE "paparazzi_albums" (
    "id" UUID NOT NULL,
    "invitationId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "maxPhotos" INTEGER NOT NULL DEFAULT 200,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paparazzi_albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paparazzi_photos" (
    "id" UUID NOT NULL,
    "albumId" UUID NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "processedKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "processedBytes" BIGINT,
    "width" INTEGER,
    "height" INTEGER,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "receiptHash" TEXT NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "includesChildData" BOOLEAN NOT NULL DEFAULT false,
    "guardianConsentAt" TIMESTAMP(3),
    "guardianConsentVersion" TEXT,
    "retentionAt" TIMESTAMP(3) NOT NULL,
    "processingStartedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "storageDeletedAt" TIMESTAMP(3),

    CONSTRAINT "paparazzi_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paparazzi_albums_invitationId_key" ON "paparazzi_albums"("invitationId");

-- CreateIndex
CREATE UNIQUE INDEX "paparazzi_albums_token_key" ON "paparazzi_albums"("token");

-- CreateIndex
CREATE UNIQUE INDEX "paparazzi_photos_sourceKey_key" ON "paparazzi_photos"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "paparazzi_photos_processedKey_key" ON "paparazzi_photos"("processedKey");

-- CreateIndex
CREATE INDEX "paparazzi_photos_albumId_status_createdAt_idx" ON "paparazzi_photos"("albumId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "paparazzi_photos_albumId_status_isVisible_createdAt_idx" ON "paparazzi_photos"("albumId", "status", "isVisible", "createdAt");

-- CreateIndex
CREATE INDEX "paparazzi_photos_retentionAt_idx" ON "paparazzi_photos"("retentionAt");

-- CreateIndex
CREATE INDEX "paparazzi_photos_deletedAt_storageDeletedAt_idx" ON "paparazzi_photos"("deletedAt", "storageDeletedAt");

-- AddForeignKey
ALTER TABLE "paparazzi_albums" ADD CONSTRAINT "paparazzi_albums_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paparazzi_photos" ADD CONSTRAINT "paparazzi_photos_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "paparazzi_albums"("id") ON DELETE CASCADE ON UPDATE CASCADE;
