-- CreateEnum
CREATE TYPE "PersonalElementOrigin" AS ENUM ('AI_GENERATED', 'AUTHORED');

-- CreateEnum
CREATE TYPE "ChatGenerationApprovalStatus" AS ENUM ('CLAIMED', 'COMPLETED', 'ABORTED');

-- CreateTable
CREATE TABLE "PersonalElement" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "type" "ElementType" NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "sources" JSONB,
    "origin" "PersonalElementOrigin" NOT NULL DEFAULT 'AI_GENERATED',
    "sourceMessageId" UUID,
    "sourceToolCallId" TEXT,
    "candidateId" TEXT,
    "eFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "correctCountStreak" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "partialCorrectCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "nextDueAt" TIMESTAMP(3),
    "lastAnsweredAt" TIMESTAMP(3),
    "lastCorrectAt" TIMESTAMP(3),
    "lastPartialCorrectAt" TIMESTAMP(3),
    "lastWrongAt" TIMESTAMP(3),
    "lastResponseCorrectness" "ResponseCorrectness",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatGenerationApproval" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "chatbotId" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "planMessageId" UUID NOT NULL,
    "planToolCallId" TEXT NOT NULL,
    "status" "ChatGenerationApprovalStatus" NOT NULL DEFAULT 'CLAIMED',
    "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
    "generatedAssistantMessageId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatGenerationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalElement_participantId_courseId_nextDueAt_idx" ON "PersonalElement"("participantId", "courseId", "nextDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalElement_participantId_sourceMessageId_sourceToolCal_key" ON "PersonalElement"("participantId", "sourceMessageId", "sourceToolCallId", "candidateId");

-- CreateIndex
CREATE INDEX "ChatGenerationApproval_threadId_status_leaseExpiresAt_idx" ON "ChatGenerationApproval"("threadId", "status", "leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatGenerationApproval_participantId_planMessageId_planTool_key" ON "ChatGenerationApproval"("participantId", "planMessageId", "planToolCallId");

-- AddForeignKey
ALTER TABLE "PersonalElement" ADD CONSTRAINT "PersonalElement_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalElement" ADD CONSTRAINT "PersonalElement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatGenerationApproval" ADD CONSTRAINT "ChatGenerationApproval_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatGenerationApproval" ADD CONSTRAINT "ChatGenerationApproval_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatGenerationApproval" ADD CONSTRAINT "ChatGenerationApproval_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "ChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatGenerationApproval" ADD CONSTRAINT "ChatGenerationApproval_planMessageId_fkey" FOREIGN KEY ("planMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatGenerationApproval" ADD CONSTRAINT "ChatGenerationApproval_generatedAssistantMessageId_fkey" FOREIGN KEY ("generatedAssistantMessageId") REFERENCES "ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
