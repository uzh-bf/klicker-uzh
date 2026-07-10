-- CreateEnum
CREATE TYPE "public"."EscapeRoomStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."EscapeRoomConfig" (
    "id" UUID NOT NULL,
    "timeLimit" INTEGER NOT NULL,
    "hintPenalty" INTEGER NOT NULL DEFAULT 30,
    "lockoutSeconds" INTEGER NOT NULL DEFAULT 5,
    "introText" TEXT,
    "practiceQuizId" UUID,
    "microLearningId" UUID,
    "groupActivityId" UUID,
    "elementBlockId" INTEGER,

    CONSTRAINT "EscapeRoomConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscapeRoomConfig_practiceQuizId_key" ON "public"."EscapeRoomConfig"("practiceQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "EscapeRoomConfig_microLearningId_key" ON "public"."EscapeRoomConfig"("microLearningId");

-- CreateIndex
CREATE UNIQUE INDEX "EscapeRoomConfig_groupActivityId_key" ON "public"."EscapeRoomConfig"("groupActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "EscapeRoomConfig_elementBlockId_key" ON "public"."EscapeRoomConfig"("elementBlockId");

-- AddForeignKey
ALTER TABLE "public"."EscapeRoomConfig" ADD CONSTRAINT "EscapeRoomConfig_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "public"."PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EscapeRoomConfig" ADD CONSTRAINT "EscapeRoomConfig_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "public"."MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EscapeRoomConfig" ADD CONSTRAINT "EscapeRoomConfig_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "public"."GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EscapeRoomConfig" ADD CONSTRAINT "EscapeRoomConfig_elementBlockId_fkey" FOREIGN KEY ("elementBlockId") REFERENCES "public"."ElementBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateTable
CREATE TABLE "public"."EscapeRoomAttempt" (
    "id" UUID NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeLimit" INTEGER NOT NULL,
    "penaltySeconds" INTEGER NOT NULL DEFAULT 0,
    "hintsUsed" JSONB NOT NULL DEFAULT '[]',
    "status" "public"."EscapeRoomStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "completedAt" TIMESTAMP(3),
    "lockoutUntil" TIMESTAMP(3),
    "statsAggregatedAt" TIMESTAMP(3),
    "participantId" UUID,
    "groupId" UUID,
    "practiceQuizId" UUID,
    "microLearningId" UUID,
    "groupActivityId" UUID,
    "elementBlockId" INTEGER,

    CONSTRAINT "EscapeRoomAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EscapeRoomAttempt_participantId_practiceQuizId_key" ON "public"."EscapeRoomAttempt"("participantId", "practiceQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "EscapeRoomAttempt_participantId_microLearningId_key" ON "public"."EscapeRoomAttempt"("participantId", "microLearningId");

-- CreateIndex
CREATE UNIQUE INDEX "EscapeRoomAttempt_groupId_groupActivityId_key" ON "public"."EscapeRoomAttempt"("groupId", "groupActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "EscapeRoomAttempt_participantId_elementBlockId_key" ON "public"."EscapeRoomAttempt"("participantId", "elementBlockId");

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

-- AddForeignKey
ALTER TABLE "public"."EscapeRoomAttempt" ADD CONSTRAINT "EscapeRoomAttempt_elementBlockId_fkey" FOREIGN KEY ("elementBlockId") REFERENCES "public"."ElementBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
