-- CreateEnum
CREATE TYPE "public"."KBGraphCostStatus" AS ENUM ('RESERVED', 'SETTLED', 'RELEASED', 'NEEDS_HUMAN_REVIEW');

-- AlterTable
ALTER TABLE "public"."KB" ADD COLUMN     "knowledgeGraphEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."KBGraphBuild" ADD COLUMN     "actualCostMinorUnits" INTEGER,
ADD COLUMN     "actualEmbeddingTokens" INTEGER,
ADD COLUMN     "actualInputTokens" INTEGER,
ADD COLUMN     "actualOutputTokens" INTEGER,
ADD COLUMN     "actualRequestCount" INTEGER,
ADD COLUMN     "costCurrency" TEXT,
ADD COLUMN     "costPricingVersion" TEXT,
ADD COLUMN     "costStatus" "public"."KBGraphCostStatus",
ADD COLUMN     "estimatedCostMinorUnits" INTEGER,
ADD COLUMN     "meteredCost" JSONB,
ADD COLUMN     "quotaId" UUID,
ADD COLUMN     "semesterKey" TEXT;

-- CreateTable
CREATE TABLE "public"."KBGraphQuota" (
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

-- CreateIndex
CREATE INDEX "KBGraphQuota_ownerId_idx" ON "public"."KBGraphQuota"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "KBGraphQuota_ownerId_semesterKey_key" ON "public"."KBGraphQuota"("ownerId", "semesterKey");

-- CreateIndex
CREATE INDEX "KBGraphBuild_quotaId_idx" ON "public"."KBGraphBuild"("quotaId");

-- AddForeignKey
ALTER TABLE "public"."KBGraphBuild" ADD CONSTRAINT "KBGraphBuild_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "public"."KBGraphQuota"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBGraphQuota" ADD CONSTRAINT "KBGraphQuota_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
