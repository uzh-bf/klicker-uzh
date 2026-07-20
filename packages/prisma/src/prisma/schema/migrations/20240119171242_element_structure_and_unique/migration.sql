/*
  Warnings:

  - A unique constraint covering the columns `[groupActivityId]` on the table `ElementStack` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[type,microLearningId,order]` on the table `ElementStack` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[type,liveQuizId,order]` on the table `ElementStack` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[type,groupActivityId,order]` on the table `ElementStack` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[type,participantId,liveQuizId]` on the table `LeaderboardEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "LiveQuizStatus" AS ENUM ('PREPARED', 'SCHEDULED', 'RUNNING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MicroLearningStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- DropForeignKey
ALTER TABLE "ElementStack" DROP CONSTRAINT "ElementStack_practiceQuizId_fkey";

-- AlterTable
ALTER TABLE "ConfusionTimestep" ADD COLUMN     "liveQuizId" UUID,
ALTER COLUMN "sessionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ElementStack" ADD COLUMN     "groupActivityId" UUID,
ADD COLUMN     "liveQuizId" UUID,
ADD COLUMN     "microLearningId" UUID;

-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN     "liveQuizId" UUID,
ALTER COLUMN "sessionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "LeaderboardEntry" ADD COLUMN     "liveQuizId" UUID;

-- DropEnum
DROP TYPE "ElementDisplayMode";

-- CreateTable
CREATE TABLE "LiveQuiz" (
    "id" UUID NOT NULL,
    "originalId" TEXT,
    "isLiveQAEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isConfusionFeedbackEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isModerationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isGamificationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "namespace" UUID NOT NULL,
    "pinCode" INTEGER,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "pointsMultiplier" INTEGER NOT NULL DEFAULT 1,
    "accessMode" "AccessMode" NOT NULL DEFAULT 'PUBLIC',
    "status" "LiveQuizStatus" NOT NULL DEFAULT 'PREPARED',
    "activeStackId" INTEGER,
    "ownerId" UUID NOT NULL,
    "courseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MicroLearning" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "pointsMultiplier" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "status" "MicroLearningStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledStartAt" TIMESTAMP(3) NOT NULL,
    "scheduledEndAt" TIMESTAMP(3) NOT NULL,
    "arePushNotificationsSent" BOOLEAN NOT NULL DEFAULT false,
    "ownerId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicroLearning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveQuiz_originalId_key" ON "LiveQuiz"("originalId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementStack_groupActivityId_key" ON "ElementStack"("groupActivityId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementStack_type_microLearningId_order_key" ON "ElementStack"("type", "microLearningId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ElementStack_type_liveQuizId_order_key" ON "ElementStack"("type", "liveQuizId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ElementStack_type_groupActivityId_order_key" ON "ElementStack"("type", "groupActivityId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_type_participantId_liveQuizId_key" ON "LeaderboardEntry"("type", "participantId", "liveQuizId");

-- AddForeignKey
ALTER TABLE "ElementStack" ADD CONSTRAINT "ElementStack_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementStack" ADD CONSTRAINT "ElementStack_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementStack" ADD CONSTRAINT "ElementStack_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementStack" ADD CONSTRAINT "ElementStack_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveQuiz" ADD CONSTRAINT "LiveQuiz_activeStackId_fkey" FOREIGN KEY ("activeStackId") REFERENCES "ElementStack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveQuiz" ADD CONSTRAINT "LiveQuiz_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveQuiz" ADD CONSTRAINT "LiveQuiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicroLearning" ADD CONSTRAINT "MicroLearning_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicroLearning" ADD CONSTRAINT "MicroLearning_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfusionTimestep" ADD CONSTRAINT "ConfusionTimestep_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
