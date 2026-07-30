-- CreateEnum
CREATE TYPE "public"."LiveQuizRewardRunStatus" AS ENUM ('APPLIED', 'REVERSED');

-- AlterTable
ALTER TABLE "public"."LiveQuiz" ADD COLUMN     "activeRewardRunId" UUID;

-- CreateTable
CREATE TABLE "public"."LiveQuizRewardRun" (
    "id" UUID NOT NULL,
    "status" "public"."LiveQuizRewardRunStatus" NOT NULL DEFAULT 'APPLIED',
    "isLegacyReconstructed" BOOLEAN NOT NULL DEFAULT false,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "liveQuizId" UUID NOT NULL,
    "reversedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveQuizRewardRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LiveQuizRewardEntry" (
    "id" SERIAL NOT NULL,
    "rewardRunId" UUID NOT NULL,
    "participantId" UUID,
    "participationId" INTEGER,
    "courseId" UUID,
    "achievementId" INTEGER,
    "coursePointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "participantXpAwarded" INTEGER NOT NULL DEFAULT 0,
    "timelineDate" DATE,
    "timelinePointsAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timelineXpAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "achievementCountAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveQuizRewardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveQuizRewardRun_liveQuizId_status_idx" ON "public"."LiveQuizRewardRun"("liveQuizId", "status");

-- CreateIndex
-- Prisma cannot model a partial unique index, so this invariant is maintained here.
CREATE UNIQUE INDEX "LiveQuizRewardRun_one_applied_per_quiz" ON "public"."LiveQuizRewardRun"("liveQuizId") WHERE "status" = 'APPLIED';

-- CreateIndex
CREATE INDEX "LiveQuizRewardEntry_participantId_idx" ON "public"."LiveQuizRewardEntry"("participantId");

-- CreateIndex
CREATE INDEX "LiveQuizRewardEntry_participationId_courseId_timelineDate_idx" ON "public"."LiveQuizRewardEntry"("participationId", "courseId", "timelineDate");

-- CreateIndex
CREATE UNIQUE INDEX "LiveQuizRewardEntry_rewardRunId_participantId_key" ON "public"."LiveQuizRewardEntry"("rewardRunId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveQuiz_activeRewardRunId_key" ON "public"."LiveQuiz"("activeRewardRunId");

-- AddForeignKey
ALTER TABLE "public"."LiveQuiz" ADD CONSTRAINT "LiveQuiz_activeRewardRunId_fkey" FOREIGN KEY ("activeRewardRunId") REFERENCES "public"."LiveQuizRewardRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LiveQuizRewardRun" ADD CONSTRAINT "LiveQuizRewardRun_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "public"."LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LiveQuizRewardRun" ADD CONSTRAINT "LiveQuizRewardRun_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LiveQuizRewardEntry" ADD CONSTRAINT "LiveQuizRewardEntry_rewardRunId_fkey" FOREIGN KEY ("rewardRunId") REFERENCES "public"."LiveQuizRewardRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LiveQuizRewardEntry" ADD CONSTRAINT "LiveQuizRewardEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LiveQuizRewardEntry" ADD CONSTRAINT "LiveQuizRewardEntry_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "public"."Participation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LiveQuizRewardEntry" ADD CONSTRAINT "LiveQuizRewardEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LiveQuizRewardEntry" ADD CONSTRAINT "LiveQuizRewardEntry_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "public"."Achievement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
