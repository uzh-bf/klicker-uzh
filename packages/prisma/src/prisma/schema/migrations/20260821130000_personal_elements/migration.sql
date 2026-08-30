-- CreateEnum
CREATE TYPE "PersonalElementOrigin" AS ENUM ('AI_GENERATED', 'AUTHORED');


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
    "sources" JSONB,
    "origin" "PersonalElementOrigin" NOT NULL DEFAULT 'AI_GENERATED',
    "sourceMessageId" UUID,
    "sourceToolCallId" TEXT,
    "candidateId" TEXT NOT NULL,
    "eFactor" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval" INTEGER NOT NULL DEFAULT 0,
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
CREATE TABLE "CardGenerationLease" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "planMessageId" UUID NOT NULL,
    "planToolCallId" TEXT NOT NULL,
    "attemptToken" TEXT NOT NULL,
    "leaseExpiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardGenerationLease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalElementDiscard" (
    "id" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "candidateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalElementDiscard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PersonalElement_participantId_courseId_nextDueAt_idx" ON "PersonalElement"("participantId", "courseId", "nextDueAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalElement_participantId_courseId_candidateId_key" ON "PersonalElement"("participantId", "courseId", "candidateId");

-- CreateIndex
CREATE INDEX "PersonalElement_courseId_idx" ON "PersonalElement"("courseId");

-- CreateIndex
CREATE INDEX "CardGenerationLease_leaseExpiresAt_idx" ON "CardGenerationLease"("leaseExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "CardGenerationLease_participantId_planMessageId_planToolCallId_key" ON "CardGenerationLease"("participantId", "planMessageId", "planToolCallId");

-- CreateIndex
CREATE INDEX "CardGenerationLease_planMessageId_idx" ON "CardGenerationLease"("planMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalElementDiscard_participantId_courseId_candidateId_key" ON "PersonalElementDiscard"("participantId", "courseId", "candidateId");

-- CreateIndex
CREATE INDEX "PersonalElementDiscard_courseId_idx" ON "PersonalElementDiscard"("courseId");

-- AddForeignKey
ALTER TABLE "PersonalElement" ADD CONSTRAINT "PersonalElement_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalElement" ADD CONSTRAINT "PersonalElement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardGenerationLease" ADD CONSTRAINT "CardGenerationLease_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardGenerationLease" ADD CONSTRAINT "CardGenerationLease_planMessageId_fkey" FOREIGN KEY ("planMessageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalElementDiscard" ADD CONSTRAINT "PersonalElementDiscard_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalElementDiscard" ADD CONSTRAINT "PersonalElementDiscard_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
