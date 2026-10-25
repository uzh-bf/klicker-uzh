-- CreateEnum
CREATE TYPE "KBResourceType" AS ENUM ('BLOB', 'URL');

-- CreateEnum
CREATE TYPE "KBResourceStatus" AS ENUM ('ADDED', 'QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "KBIngestionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "KBIngestionOperation" AS ENUM ('UPSERT', 'DELETE');

-- CreateEnum
CREATE TYPE "KBGraphBuildStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "KBGraphQualityTier" AS ENUM ('STANDARD', 'HIGH');

-- CreateEnum
CREATE TYPE "KBGraphCostStatus" AS ENUM ('RESERVED', 'SETTLED', 'RELEASED', 'NEEDS_HUMAN_REVIEW');

-- CreateTable
CREATE TABLE "KB" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" UUID NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,
    "activeGraphBuildId" UUID,
    "publishedGraphBuildId" UUID,
    "knowledgeGraphEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KB_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBResource" (
    "id" UUID NOT NULL,
    "type" "KBResourceType" NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "originalFilename" TEXT,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "blobName" TEXT,
    "blobHref" TEXT,
    "status" "KBResourceStatus" NOT NULL DEFAULT 'ADDED',
    "statusMessage" TEXT,
    "ingestedAt" TIMESTAMP(3),
    "ingestionAttemptId" UUID,
    "resourceVersion" INTEGER NOT NULL DEFAULT 0,
    "contentSha256" TEXT,
    "externalOperationId" TEXT,
    "externalOperationStartedAt" TIMESTAMP(3),
    "activeResourceVersion" INTEGER,
    "activeContentSha256" TEXT,
    "errorCode" TEXT,
    "ingestionOperation" "KBIngestionOperation" NOT NULL DEFAULT 'UPSERT',
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,
    "kbId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBIngestionRun" (
    "id" UUID NOT NULL,
    "operation" "KBIngestionOperation" NOT NULL DEFAULT 'UPSERT',
    "status" "KBIngestionStatus" NOT NULL DEFAULT 'QUEUED',
    "resourceVersion" INTEGER NOT NULL,
    "contentSha256" TEXT,
    "externalOperationId" TEXT,
    "statusMessage" TEXT,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "resourceId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBIngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBGraphBuild" (
    "id" UUID NOT NULL,
    "status" "KBGraphBuildStatus" NOT NULL DEFAULT 'QUEUED',
    "qualityTier" "KBGraphQualityTier" NOT NULL DEFAULT 'STANDARD',
    "sourceContentDigest" TEXT NOT NULL,
    "graphName" TEXT NOT NULL,
    "graphmlBlobName" TEXT,
    "estimatedCostMinorUnits" INTEGER,
    "actualCostMinorUnits" INTEGER,
    "actualInputTokens" INTEGER,
    "actualOutputTokens" INTEGER,
    "actualEmbeddingTokens" INTEGER,
    "actualRequestCount" INTEGER,
    "costCurrency" TEXT,
    "costPricingVersion" TEXT,
    "costStatus" "KBGraphCostStatus",
    "meteredCost" JSONB,
    "semesterKey" TEXT,
    "quotaId" UUID,
    "externalOperationId" TEXT,
    "externalStartedAt" TIMESTAMP(3),
    "dispatchClaimedAt" TIMESTAMP(3),
    "statusMessage" TEXT,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cleanupStartedAt" TIMESTAMP(3),
    "cleanedAt" TIMESTAMP(3),
    "graphmlPurgedAt" TIMESTAMP(3),
    "requestedById" UUID,
    "kbId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBGraphBuild_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBGraphQuota" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "semesterKey" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "limitMinorUnits" INTEGER NOT NULL,
    "reservedMinorUnits" INTEGER NOT NULL DEFAULT 0,
    "settledMinorUnits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBGraphQuota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBGraphBuildSource" (
    "id" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "type" "KBResourceType" NOT NULL,
    "contentSha256" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "blobName" TEXT,
    "buildId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KBGraphBuildSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBUploadTicket" (
    "id" UUID NOT NULL,
    "blobName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "kbId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KBUploadTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KBChatbot" (
    "id" UUID NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "kbId" UUID NOT NULL,
    "chatbotId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBChatbot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KB_ownerId_idx" ON "KB"("ownerId");

-- CreateIndex
CREATE INDEX "KB_deletedAt_idx" ON "KB"("deletedAt");

-- CreateIndex
CREATE INDEX "KBResource_kbId_status_idx" ON "KBResource"("kbId", "status");

-- CreateIndex
CREATE INDEX "KBResource_status_idx" ON "KBResource"("status");

-- CreateIndex
CREATE INDEX "KBResource_deletedAt_idx" ON "KBResource"("deletedAt");

-- CreateIndex
CREATE INDEX "KBIngestionRun_resourceId_createdAt_idx" ON "KBIngestionRun"("resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "KBIngestionRun_status_idx" ON "KBIngestionRun"("status");

-- CreateIndex
CREATE INDEX "KBGraphBuild_kbId_createdAt_idx" ON "KBGraphBuild"("kbId", "createdAt");

-- CreateIndex
CREATE INDEX "KBGraphBuild_status_idx" ON "KBGraphBuild"("status");

-- CreateIndex
CREATE INDEX "KBGraphBuild_quotaId_idx" ON "KBGraphBuild"("quotaId");

-- CreateIndex
CREATE INDEX "KBGraphQuota_ownerId_idx" ON "KBGraphQuota"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "KBGraphQuota_ownerId_semesterKey_key" ON "KBGraphQuota"("ownerId", "semesterKey");

-- CreateIndex
CREATE INDEX "KBGraphBuildSource_resourceId_idx" ON "KBGraphBuildSource"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "KBGraphBuildSource_buildId_resourceId_key" ON "KBGraphBuildSource"("buildId", "resourceId");

-- CreateIndex
CREATE INDEX "KBUploadTicket_expiresAt_idx" ON "KBUploadTicket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "KBUploadTicket_kbId_blobName_key" ON "KBUploadTicket"("kbId", "blobName");

-- CreateIndex
CREATE INDEX "KBChatbot_chatbotId_idx" ON "KBChatbot"("chatbotId");

-- CreateIndex
CREATE UNIQUE INDEX "KBChatbot_kbId_chatbotId_key" ON "KBChatbot"("kbId", "chatbotId");

-- Enforce the product invariant even across concurrent writers.
CREATE UNIQUE INDEX "KBChatbot_one_enabled_per_chatbot_key"
ON "KBChatbot"("chatbotId")
WHERE "isEnabled" = true;

-- AddForeignKey
ALTER TABLE "KB" ADD CONSTRAINT "KB_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KB" ADD CONSTRAINT "KB_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBResource" ADD CONSTRAINT "KBResource_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBResource" ADD CONSTRAINT "KBResource_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBIngestionRun" ADD CONSTRAINT "KBIngestionRun_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "KBResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBGraphBuild" ADD CONSTRAINT "KBGraphBuild_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "KBGraphQuota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBGraphBuild" ADD CONSTRAINT "KBGraphBuild_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBGraphBuild" ADD CONSTRAINT "KBGraphBuild_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBGraphQuota" ADD CONSTRAINT "KBGraphQuota_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBGraphBuildSource" ADD CONSTRAINT "KBGraphBuildSource_buildId_fkey" FOREIGN KEY ("buildId") REFERENCES "KBGraphBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBUploadTicket" ADD CONSTRAINT "KBUploadTicket_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "KB"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBChatbot" ADD CONSTRAINT "KBChatbot_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KBChatbot" ADD CONSTRAINT "KBChatbot_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
