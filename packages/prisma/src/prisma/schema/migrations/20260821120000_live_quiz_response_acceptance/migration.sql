-- AlterTable
ALTER TABLE "LiveQuizResponse"
ADD COLUMN "acceptedAt" TIMESTAMP(3),
ADD COLUMN "correlationId" TEXT;

-- CreateIndex
CREATE INDEX "LiveQuizResponse_correlationId_idx"
ON "LiveQuizResponse"("correlationId");

-- CreateTable
CREATE TABLE "AssessmentResponseEffect" (
    "responseId" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentResponseEffect_pkey" PRIMARY KEY ("responseId")
);

-- AddForeignKey
ALTER TABLE "AssessmentResponseEffect"
ADD CONSTRAINT "AssessmentResponseEffect_responseId_fkey"
FOREIGN KEY ("responseId") REFERENCES "LiveQuizResponse"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
