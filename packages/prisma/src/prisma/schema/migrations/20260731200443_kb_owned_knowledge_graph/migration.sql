-- CreateEnum
CREATE TYPE "public"."KBGraphBuildStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "public"."KBGraphQualityTier" AS ENUM ('STANDARD', 'HIGH');

-- AlterTable
ALTER TABLE "public"."KB" ADD COLUMN     "activeGraphBuildId" UUID,
ADD COLUMN     "publishedGraphBuildId" UUID;

-- CreateTable
CREATE TABLE "public"."KBGraphBuild" (
    "id" UUID NOT NULL,
    "status" "public"."KBGraphBuildStatus" NOT NULL DEFAULT 'QUEUED',
    "qualityTier" "public"."KBGraphQualityTier" NOT NULL DEFAULT 'STANDARD',
    "sourceContentDigest" TEXT NOT NULL,
    "graphName" TEXT NOT NULL,
    "graphmlBlobName" TEXT,
    "externalOperationId" TEXT,
    "externalStartedAt" TIMESTAMP(3),
    "statusMessage" TEXT,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "requestedById" UUID,
    "kbId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBGraphBuild_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KBGraphBuild_kbId_createdAt_idx" ON "public"."KBGraphBuild"("kbId", "createdAt");

-- CreateIndex
CREATE INDEX "KBGraphBuild_status_idx" ON "public"."KBGraphBuild"("status");

-- AddForeignKey
ALTER TABLE "public"."KBGraphBuild" ADD CONSTRAINT "KBGraphBuild_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBGraphBuild" ADD CONSTRAINT "KBGraphBuild_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "public"."KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;
