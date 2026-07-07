-- CreateEnum
CREATE TYPE "public"."EscapeRoomStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'EXPIRED');

-- AlterTable
ALTER TABLE "public"."GroupActivity" ADD COLUMN     "escapeRoomHintPenalty" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "escapeRoomTimeLimit" INTEGER NOT NULL DEFAULT 3600,
ADD COLUMN     "isEscapeRoom" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."MicroLearning" ADD COLUMN     "escapeRoomHintPenalty" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "escapeRoomTimeLimit" INTEGER NOT NULL DEFAULT 3600,
ADD COLUMN     "isEscapeRoom" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."PracticeQuiz" ADD COLUMN     "escapeRoomHintPenalty" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "escapeRoomTimeLimit" INTEGER NOT NULL DEFAULT 3600,
ADD COLUMN     "isEscapeRoom" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."EscapeRoomAttempt" (
    "id" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeLimit" INTEGER NOT NULL,
    "penaltySeconds" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" JSONB NOT NULL DEFAULT '[]',
    "status" "public"."EscapeRoomStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "participantId" UUID,
    "groupId" UUID,
    "practiceQuizId" UUID,
    "microLearningId" UUID,
    "groupActivityId" UUID,

    CONSTRAINT "EscapeRoomAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscapeRoomAttempt_participantId_practiceQuizId_key" ON "public"."EscapeRoomAttempt"("participantId", "practiceQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "EscapeRoomAttempt_participantId_microLearningId_key" ON "public"."EscapeRoomAttempt"("participantId", "microLearningId");

-- CreateIndex
CREATE UNIQUE INDEX "EscapeRoomAttempt_groupId_groupActivityId_key" ON "public"."EscapeRoomAttempt"("groupId", "groupActivityId");

-- AddForeignKey
ALTER TABLE "public"."EscapeRoomAttempt" ADD CONSTRAINT "EscapeRoomAttempt_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EscapeRoomAttempt" ADD CONSTRAINT "EscapeRoomAttempt_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."ParticipantGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EscapeRoomAttempt" ADD CONSTRAINT "EscapeRoomAttempt_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "public"."PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EscapeRoomAttempt" ADD CONSTRAINT "EscapeRoomAttempt_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "public"."MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EscapeRoomAttempt" ADD CONSTRAINT "EscapeRoomAttempt_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "public"."GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
