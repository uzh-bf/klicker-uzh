/*
  Warnings:

  - You are about to drop the column `sessionId` on the `ConfusionTimestep` table. All the data in the column will be lost.
  - You are about to drop the column `migrationId` on the `ElementInstance` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `Feedback` table. All the data in the column will be lost.
  - You are about to drop the column `sessionId` on the `LeaderboardEntry` table. All the data in the column will be lost.
  - You are about to drop the `LiveSession` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionInstance` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SessionBlock` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `liveQuizId` on table `ConfusionTimestep` required. This step will fail if there are existing NULL values in that column.
  - Made the column `liveQuizId` on table `Feedback` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ConfusionTimestep" DROP CONSTRAINT "ConfusionTimestep_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "LeaderboardEntry" DROP CONSTRAINT "LeaderboardEntry_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "LiveSession" DROP CONSTRAINT "LiveSession_activeBlockId_fkey";

-- DropForeignKey
ALTER TABLE "LiveSession" DROP CONSTRAINT "LiveSession_courseId_fkey";

-- DropForeignKey
ALTER TABLE "LiveSession" DROP CONSTRAINT "LiveSession_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionInstance" DROP CONSTRAINT "QuestionInstance_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionInstance" DROP CONSTRAINT "QuestionInstance_questionId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionInstance" DROP CONSTRAINT "QuestionInstance_sessionBlockId_fkey";

-- DropForeignKey
ALTER TABLE "SessionBlock" DROP CONSTRAINT "SessionBlock_sessionId_fkey";

-- DropIndex
DROP INDEX "ElementInstance_type_migrationId_key";

-- DropIndex
DROP INDEX "LeaderboardEntry_type_participantId_sessionId_key";

-- AlterTable
ALTER TABLE "ConfusionTimestep" DROP COLUMN "sessionId",
ALTER COLUMN "liveQuizId" SET NOT NULL;

-- AlterTable
ALTER TABLE "ElementInstance" DROP COLUMN "migrationId";

-- AlterTable
ALTER TABLE "Feedback" DROP COLUMN "sessionId",
ALTER COLUMN "liveQuizId" SET NOT NULL;

-- AlterTable
ALTER TABLE "LeaderboardEntry" DROP COLUMN "sessionId";

-- AlterTable
ALTER TABLE "QuestionResponse" ALTER COLUMN "averageTimeSpent" DROP DEFAULT;

-- AlterTable
ALTER TABLE "QuestionResponseDetail" ALTER COLUMN "timeSpent" DROP DEFAULT;

-- DropTable
DROP TABLE "LiveSession";

-- DropTable
DROP TABLE "QuestionInstance";

-- DropTable
DROP TABLE "SessionBlock";

-- DropEnum
DROP TYPE "QuestionInstanceType";

-- DropEnum
DROP TYPE "SessionBlockStatus";

-- DropEnum
DROP TYPE "SessionStatus";
