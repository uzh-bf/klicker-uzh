-- CreateEnum
CREATE TYPE "BaselineReportStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'INCOMPLETE');

-- CreateEnum
CREATE TYPE "BaselineCaseStatus" AS ENUM ('PENDING', 'TARGET_COMPLETE', 'COMPLETED', 'UNASSESSED');

-- CreateEnum
CREATE TYPE "BaselineOperationStage" AS ENUM ('TARGET', 'JUDGE');

-- CreateEnum
CREATE TYPE "BaselineOperationStatus" AS ENUM ('CLAIMED', 'DISPATCHED', 'SETTLED', 'RELEASED', 'UNCERTAIN');

-- CreateTable
CREATE TABLE "ResponseExampleBaselineReport" (
    "id" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "setDigest" TEXT NOT NULL,
    "configurationDigest" TEXT NOT NULL,
    "status" "BaselineReportStatus" NOT NULL DEFAULT 'QUEUED',
    "excludedCount" INTEGER NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3) NOT NULL,
    "errorCode" TEXT,
    "modelId" TEXT,
    "modelConfigurationDigest" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseExampleBaselineReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseExampleBaselineCase" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "exampleId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "chatMode" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "idealAnswer" TEXT NOT NULL,
    "expectedEvidence" JSONB NOT NULL,
    "status" "BaselineCaseStatus" NOT NULL DEFAULT 'PENDING',
    "actualAnswer" TEXT,
    "actualEvidence" JSONB,
    "assessment" JSONB,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseExampleBaselineCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseExampleBaselineOperation" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "ownerSlotId" UUID,
    "chatbotId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "caseId" UUID NOT NULL,
    "stage" "BaselineOperationStage" NOT NULL,
    "status" "BaselineOperationStatus" NOT NULL DEFAULT 'CLAIMED',
    "monthStart" DATE NOT NULL,
    "inputRate" DECIMAL(18,6) NOT NULL,
    "outputRate" DECIMAL(18,6) NOT NULL,
    "creditsUsed" DECIMAL(18,6),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseExampleBaselineOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResponseExampleBaselineReport_setId_key" ON "ResponseExampleBaselineReport"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineCase_report_example_key" ON "ResponseExampleBaselineCase"("reportId", "exampleId");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineCase_report_order_key" ON "ResponseExampleBaselineCase"("reportId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseExampleBaselineOperation_ownerSlotId_key" ON "ResponseExampleBaselineOperation"("ownerSlotId");

-- CreateIndex
CREATE INDEX "BaselineOperation_owner_status_idx" ON "ResponseExampleBaselineOperation"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineOperation_run_case_stage_key" ON "ResponseExampleBaselineOperation"("runId", "caseId", "stage");

-- AddForeignKey
ALTER TABLE "ResponseExampleBaselineReport" ADD CONSTRAINT "ResponseExampleBaselineReport_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ResponseExampleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseExampleBaselineCase" ADD CONSTRAINT "ResponseExampleBaselineCase_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "ResponseExampleBaselineReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseExampleBaselineOperation" ADD CONSTRAINT "ResponseExampleBaselineOperation_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
