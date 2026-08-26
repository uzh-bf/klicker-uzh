-- CreateEnum
CREATE TYPE "ResponseExampleStatus" AS ENUM ('CANDIDATE', 'APPROVED', 'NEEDS_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "ResponseExampleStyle" AS ENUM ('GUIDED_QUESTIONS', 'STEP_BY_STEP_EXPLANATION', 'CONCISE_ANSWER', 'CLARIFYING_QUESTION', 'WORKED_EXAMPLE', 'COMPARE_OPTIONS');

-- CreateTable
CREATE TABLE "ResponseExampleSet" (
    "id" UUID NOT NULL,
    "chatbotId" UUID NOT NULL,
    "digest" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseExampleSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseExample" (
    "id" UUID NOT NULL,
    "setId" UUID NOT NULL,
    "chatMode" TEXT NOT NULL,
    "studentMessage" TEXT NOT NULL,
    "referenceAnswer" TEXT NOT NULL,
    "responseStyle" "ResponseExampleStyle" NOT NULL,
    "status" "ResponseExampleStatus" NOT NULL DEFAULT 'CANDIDATE',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResponseExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResponseExampleEvidenceReference" (
    "id" UUID NOT NULL,
    "responseExampleId" UUID NOT NULL,
    "sourceId" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "citationIndex" INTEGER NOT NULL,
    "citationAnchor" TEXT NOT NULL,
    "evidenceEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResponseExampleEvidenceReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResponseExampleSet_chatbotId_key" ON "ResponseExampleSet"("chatbotId");

-- CreateIndex
CREATE INDEX "ResponseExample_set_mode_status_idx" ON "ResponseExample"("setId", "chatMode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseExample_set_mode_question_key" ON "ResponseExample"("setId", "chatMode", "studentMessage");

-- CreateIndex
CREATE INDEX "ResponseExampleEvidence_responseExampleId_idx" ON "ResponseExampleEvidenceReference"("responseExampleId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseExampleEvidence_citationIndex_key" ON "ResponseExampleEvidenceReference"("responseExampleId", "citationIndex");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseExampleEvidence_source_key" ON "ResponseExampleEvidenceReference"("responseExampleId", "sourceId", "chunkId", "contentHash", "citationAnchor");

-- AddForeignKey
ALTER TABLE "ResponseExampleSet" ADD CONSTRAINT "ResponseExampleSet_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseExample" ADD CONSTRAINT "ResponseExample_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ResponseExampleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseExampleEvidenceReference" ADD CONSTRAINT "ResponseExampleEvidenceReference_responseExampleId_fkey" FOREIGN KEY ("responseExampleId") REFERENCES "ResponseExample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
