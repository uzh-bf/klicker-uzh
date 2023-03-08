/*
  Warnings:

  - You are about to drop the column `learningElementId` on the `QuestionInstance` table. All the data in the column will be lost.
  - You are about to drop the `_ParticipationToQuestionInstance` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[stackElementId]` on the table `QuestionInstance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[type,stackElementId,order]` on the table `QuestionInstance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "QuestionStackType" AS ENUM ('LEARNING_ELEMENT', 'MICRO_SESSION', 'LIVE_SESSION', 'GROUP_ACTIVITY');

-- DropForeignKey
ALTER TABLE "QuestionInstance" DROP CONSTRAINT "QuestionInstance_learningElementId_fkey";

-- DropForeignKey
ALTER TABLE "_ParticipationToQuestionInstance" DROP CONSTRAINT "_ParticipationToQuestionInstance_A_fkey";

-- DropForeignKey
ALTER TABLE "_ParticipationToQuestionInstance" DROP CONSTRAINT "_ParticipationToQuestionInstance_B_fkey";

-- DropIndex
DROP INDEX "QuestionInstance_type_learningElementId_order_key";

-- AlterTable
ALTER TABLE "QuestionInstance" DROP COLUMN "learningElementId",
ADD COLUMN     "stackElementId" INTEGER;

-- DropTable
DROP TABLE "_ParticipationToQuestionInstance";

-- CreateTable
CREATE TABLE "QuestionStack" (
    "id" SERIAL NOT NULL,
    "type" "QuestionStackType" NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "order" INTEGER,
    "learningElementId" UUID,

    CONSTRAINT "QuestionStack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StackElement" (
    "id" SERIAL NOT NULL,
    "order" INTEGER,
    "stackId" INTEGER NOT NULL,
    "mdContent" TEXT,

    CONSTRAINT "StackElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ParticipationToQuestionStack" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionStack_type_learningElementId_order_key" ON "QuestionStack"("type", "learningElementId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "_ParticipationToQuestionStack_AB_unique" ON "_ParticipationToQuestionStack"("A", "B");

-- CreateIndex
CREATE INDEX "_ParticipationToQuestionStack_B_index" ON "_ParticipationToQuestionStack"("B");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionInstance_stackElementId_key" ON "QuestionInstance"("stackElementId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionInstance_type_stackElementId_order_key" ON "QuestionInstance"("type", "stackElementId", "order");

-- AddForeignKey
ALTER TABLE "QuestionInstance" ADD CONSTRAINT "QuestionInstance_stackElementId_fkey" FOREIGN KEY ("stackElementId") REFERENCES "StackElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionStack" ADD CONSTRAINT "QuestionStack_learningElementId_fkey" FOREIGN KEY ("learningElementId") REFERENCES "LearningElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StackElement" ADD CONSTRAINT "StackElement_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "QuestionStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipationToQuestionStack" ADD CONSTRAINT "_ParticipationToQuestionStack_A_fkey" FOREIGN KEY ("A") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipationToQuestionStack" ADD CONSTRAINT "_ParticipationToQuestionStack_B_fkey" FOREIGN KEY ("B") REFERENCES "QuestionStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
