-- CreateEnum
CREATE TYPE "ResponseExampleStatus" AS ENUM ('CANDIDATE', 'APPROVED', 'NEEDS_REVIEW', 'REJECTED');

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
    "locale" TEXT NOT NULL,
    "studentTurn" TEXT NOT NULL,
    "idealResponse" TEXT NOT NULL,
    "behaviorTag" TEXT NOT NULL,
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
    "citationAnchor" TEXT NOT NULL,
    "evidenceEligible" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResponseExampleEvidenceReference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ResponseExampleSet_chatbotId_key" ON "ResponseExampleSet"("chatbotId");

-- CreateIndex
CREATE INDEX "ResponseExample_setId_chatMode_locale_status_idx" ON "ResponseExample"("setId", "chatMode", "locale", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseExample_setId_chatMode_locale_studentTurn_key" ON "ResponseExample"("setId", "chatMode", "locale", "studentTurn");

-- CreateIndex
CREATE INDEX "ResponseExampleEvidenceReference_responseExampleId_idx" ON "ResponseExampleEvidenceReference"("responseExampleId");

-- CreateIndex
CREATE UNIQUE INDEX "ResponseExampleEvidenceReference_responseExampleId_sourceId_key" ON "ResponseExampleEvidenceReference"("responseExampleId", "sourceId", "chunkId", "contentHash", "citationAnchor");

-- AddForeignKey
ALTER TABLE "ResponseExampleSet" ADD CONSTRAINT "ResponseExampleSet_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseExample" ADD CONSTRAINT "ResponseExample_setId_fkey" FOREIGN KEY ("setId") REFERENCES "ResponseExampleSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResponseExampleEvidenceReference" ADD CONSTRAINT "ResponseExampleEvidenceReference_responseExampleId_fkey" FOREIGN KEY ("responseExampleId") REFERENCES "ResponseExample"("id") ON DELETE CASCADE ON UPDATE CASCADE;
