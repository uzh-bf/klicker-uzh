-- CreateEnum
CREATE TYPE "DataExportStatus" AS ENUM ('PENDING', 'RELEASED', 'FAILED');

-- CreateTable
CREATE TABLE "ResearchExportReceipt" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "projectTitle" TEXT NOT NULL,
    "responsiblePerson" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "deletionDate" DATE NOT NULL,
    "reference" TEXT,
    "selectedClasses" TEXT[],
    "disclosureVersion" TEXT NOT NULL,
    "attestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "sha256" TEXT,
    "byteCount" INTEGER,
    "recordCount" INTEGER,
    "failureCode" TEXT,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "ResearchExportReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentExportReceipt" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "liveQuizId" UUID,
    "locale" TEXT NOT NULL,
    "disclosureVersion" TEXT NOT NULL,
    "attestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "DataExportStatus" NOT NULL DEFAULT 'PENDING',
    "sha256" TEXT,
    "byteCount" INTEGER,
    "recordCount" INTEGER,
    "failureCode" TEXT,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "AssessmentExportReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ResearchExportReceipt_requesterId_attestedAt_idx" ON "ResearchExportReceipt"("requesterId", "attestedAt");

-- CreateIndex
CREATE INDEX "ResearchExportReceipt_courseId_attestedAt_idx" ON "ResearchExportReceipt"("courseId", "attestedAt");

-- CreateIndex
CREATE INDEX "AssessmentExportReceipt_requesterId_attestedAt_idx" ON "AssessmentExportReceipt"("requesterId", "attestedAt");

-- CreateIndex
CREATE INDEX "AssessmentExportReceipt_courseId_attestedAt_idx" ON "AssessmentExportReceipt"("courseId", "attestedAt");
