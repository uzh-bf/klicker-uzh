/*
  Warnings:

  - You are about to drop the column `liveQuizId` on the `ElementStack` table. All the data in the column will be lost.
  - You are about to drop the column `options` on the `ElementStack` table. All the data in the column will be lost.
  - You are about to drop the column `originalId` on the `ElementStack` table. All the data in the column will be lost.
  - You are about to drop the column `activeStackId` on the `LiveQuiz` table. All the data in the column will be lost.
  - The `status` column on the `LiveQuiz` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[type,elementBlockId,order]` on the table `ElementInstance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ElementStackTypeNew" AS ENUM ('PRACTICE_QUIZ', 'MICROLEARNING', 'GROUP_ACTIVITY');

-- CreateEnum
CREATE TYPE "ElementBlockStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'EXECUTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PublicationStatus" ADD VALUE 'ENDED';
ALTER TYPE "PublicationStatus" ADD VALUE 'GRADED';

-- DropForeignKey
ALTER TABLE "ElementStack" DROP CONSTRAINT "ElementStack_liveQuizId_fkey";

-- DropForeignKey
ALTER TABLE "LiveQuiz" DROP CONSTRAINT "LiveQuiz_activeStackId_fkey";

-- DropIndex
DROP INDEX "ElementStack_originalId_key";

-- DropIndex
DROP INDEX "ElementStack_type_liveQuizId_order_key";

-- AlterTable
ALTER TABLE "ElementInstance" ADD COLUMN     "elementBlockId" INTEGER,
ALTER COLUMN "elementStackId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ElementStack" DROP COLUMN "liveQuizId",
DROP COLUMN "options",
DROP COLUMN "originalId",
ADD COLUMN     "typeNEW" "ElementStackTypeNew";

-- AlterTable
ALTER TABLE "GroupActivity" ADD COLUMN     "statusNEW" "PublicationStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "LiveQuiz" DROP COLUMN "activeStackId",
ADD COLUMN     "activeBlockId" INTEGER,
DROP COLUMN "status",
ADD COLUMN     "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT';

-- DropEnum
DROP TYPE "LiveQuizStatus";

-- CreateTable
CREATE TABLE "ElementBlock" (
    "id" SERIAL NOT NULL,
    "originalId" INTEGER,
    "order" INTEGER NOT NULL,
    "timeLimit" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "randomSelection" INTEGER,
    "execution" INTEGER NOT NULL DEFAULT 0,
    "status" "ElementBlockStatus" NOT NULL DEFAULT 'SCHEDULED',
    "liveQuizId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ElementBlock_liveQuizId_order_key" ON "ElementBlock"("liveQuizId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ElementInstance_type_elementBlockId_order_key" ON "ElementInstance"("type", "elementBlockId", "order");

-- AddForeignKey
ALTER TABLE "ElementInstance" ADD CONSTRAINT "ElementInstance_elementBlockId_fkey" FOREIGN KEY ("elementBlockId") REFERENCES "ElementBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementBlock" ADD CONSTRAINT "ElementBlock_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveQuiz" ADD CONSTRAINT "LiveQuiz_activeBlockId_fkey" FOREIGN KEY ("activeBlockId") REFERENCES "ElementBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
