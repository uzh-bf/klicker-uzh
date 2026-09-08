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
CREATE INDEX "AssessmentExportReceipt_requesterId_attestedAt_idx" ON "AssessmentExportReceipt"("requesterId", "attestedAt");

-- CreateIndex
CREATE INDEX "AssessmentExportReceipt_courseId_attestedAt_idx" ON "AssessmentExportReceipt"("courseId", "attestedAt");
