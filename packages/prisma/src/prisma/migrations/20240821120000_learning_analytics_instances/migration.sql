-- CreateEnum
CREATE TYPE "ResponseCorrectness" AS ENUM ('CORRECT', 'PARTIAL', 'WRONG');

-- AlterTable
ALTER TABLE "ElementInstance" ADD COLUMN     "anonymousResults" JSONB;

-- AlterTable
ALTER TABLE "MicroLearning" ADD COLUMN     "completedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PracticeQuiz" ADD COLUMN     "completedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "repeatedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startedCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "QuestionResponse" ADD COLUMN     "courseId" UUID,
ADD COLUMN     "firstResponse" JSONB,
ADD COLUMN     "firstResponseCorrectness" "ResponseCorrectness",
ADD COLUMN     "responseCorrectness" "ResponseCorrectness";

-- CreateTable
CREATE TABLE "InstanceStatistics" (
    "anonymousCorrectCount" INTEGER,
    "anonymousPartialCorrectCount" INTEGER,
    "anonymousWrongCount" INTEGER,
    "upvoteCount" INTEGER,
    "downvoteCount" INTEGER,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "partialCorrectCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "firstCorrectCount" INTEGER,
    "firstPartialCorrectCount" INTEGER,
    "firstWrongCount" INTEGER,
    "lastCorrectCount" INTEGER,
    "lastPartialCorrectCount" INTEGER,
    "lastWrongCount" INTEGER,
    "uniqueParticipantCount" INTEGER NOT NULL DEFAULT 0,
    "averageTimeSpent" INTEGER,
    "elementInstanceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceStatistics_pkey" PRIMARY KEY ("elementInstanceId")
);

-- AddForeignKey
ALTER TABLE "InstanceStatistics" ADD CONSTRAINT "InstanceStatistics_elementInstanceId_fkey" FOREIGN KEY ("elementInstanceId") REFERENCES "ElementInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
