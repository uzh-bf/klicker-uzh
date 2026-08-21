-- AlterTable
ALTER TABLE "LiveQuizResponse"
ADD COLUMN "acceptedAt" TIMESTAMP(3),
ADD COLUMN "correlationId" TEXT;

-- CreateIndex
CREATE INDEX "LiveQuizResponse_correlationId_idx"
ON "LiveQuizResponse"("correlationId");

-- CreateTable
CREATE TABLE "AssessmentResponseEffect" (
    "id" SERIAL NOT NULL,
    "responseId" INTEGER NOT NULL,
    "correlationId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentResponseEffect_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentResponseEffect_responseId_key"
ON "AssessmentResponseEffect"("responseId");

CREATE INDEX "AssessmentResponseEffect_correlationId_idx"
ON "AssessmentResponseEffect"("correlationId");

-- AddForeignKey
ALTER TABLE "AssessmentResponseEffect"
ADD CONSTRAINT "AssessmentResponseEffect_responseId_fkey"
FOREIGN KEY ("responseId") REFERENCES "LiveQuizResponse"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
