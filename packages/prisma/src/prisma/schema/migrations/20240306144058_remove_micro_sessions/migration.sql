/*
  Warnings:

  - You are about to drop the column `completedMicroSessions` on the `Participation` table. All the data in the column will be lost.
  - You are about to drop the column `microSessionId` on the `QuestionInstance` table. All the data in the column will be lost.
  - You are about to drop the `MicroSession` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `status` on table `MicroLearning` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "MicroSession" DROP CONSTRAINT "MicroSession_courseId_fkey";

-- DropForeignKey
ALTER TABLE "MicroSession" DROP CONSTRAINT "MicroSession_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionInstance" DROP CONSTRAINT "QuestionInstance_microSessionId_fkey";

-- DropIndex
DROP INDEX "QuestionInstance_type_microSessionId_order_key";

-- AlterTable
ALTER TABLE "MicroLearning" ALTER COLUMN "status" SET NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Participation" DROP COLUMN "completedMicroSessions";

-- AlterTable
ALTER TABLE "QuestionInstance" DROP COLUMN "microSessionId";

-- DropTable
DROP TABLE "MicroSession";

-- DropEnum
DROP TYPE "MicroLearningStatus";

-- DropEnum
DROP TYPE "MicroSessionStatus";
