-- AlterEnum
ALTER TYPE "public"."ElementType" ADD VALUE 'CODE';

-- CreateEnum
CREATE TYPE "public"."CodeSubmissionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."CodeSubmission" (
    "id" UUID NOT NULL,
    "status" "public"."CodeSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "code" TEXT NOT NULL,
    "timeSpent" REAL NOT NULL,
    "result" JSONB,
    "claimToken" UUID,
    "claimExpiresAt" TIMESTAMP(3),
    "claimAttempts" INTEGER NOT NULL DEFAULT 0,
    "failureCode" TEXT,
    "failureDetails" TEXT,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "participantId" UUID NOT NULL,
    "participationId" INTEGER NOT NULL,
    "elementInstanceId" INTEGER NOT NULL,
    "practiceQuizId" UUID,
    "microLearningId" UUID,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeSubmission_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CodeSubmission_activity_check" CHECK (
        ("practiceQuizId" IS NOT NULL AND "microLearningId" IS NULL) OR
        ("practiceQuizId" IS NULL AND "microLearningId" IS NOT NULL)
    )
);

-- CreateIndex
CREATE INDEX "CodeSubmission_participantId_elementInstanceId_createdAt_idx" ON "public"."CodeSubmission"("participantId", "elementInstanceId", "createdAt");

-- CreateIndex
CREATE INDEX "CodeSubmission_practiceQuizId_idx" ON "public"."CodeSubmission"("practiceQuizId");

-- CreateIndex
CREATE INDEX "CodeSubmission_microLearningId_idx" ON "public"."CodeSubmission"("microLearningId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeSubmission_active_participant_instance_key" ON "public"."CodeSubmission"("participantId", "elementInstanceId") WHERE "status" IN ('PENDING', 'RUNNING');

-- AddForeignKey
ALTER TABLE "public"."CodeSubmission" ADD CONSTRAINT "CodeSubmission_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CodeSubmission" ADD CONSTRAINT "CodeSubmission_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "public"."Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CodeSubmission" ADD CONSTRAINT "CodeSubmission_elementInstanceId_fkey" FOREIGN KEY ("elementInstanceId") REFERENCES "public"."ElementInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CodeSubmission" ADD CONSTRAINT "CodeSubmission_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "public"."PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CodeSubmission" ADD CONSTRAINT "CodeSubmission_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "public"."MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CodeSubmission" ADD CONSTRAINT "CodeSubmission_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
