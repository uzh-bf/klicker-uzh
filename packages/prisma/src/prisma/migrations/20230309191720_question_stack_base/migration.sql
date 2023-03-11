/*
  Warnings:
  - A unique constraint covering the columns `[questionStackId]` on the table `GroupActivity` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stackElementId]` on the table `QuestionInstance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[type,stackElementId,order]` on the table `QuestionInstance` will be added. If there are existing duplicate values, this will fail.
*/
-- CreateEnum
CREATE TYPE "QuestionStackType" AS ENUM ('LEARNING_ELEMENT', 'MICRO_SESSION', 'LIVE_SESSION', 'GROUP_ACTIVITY');

-- DropForeignKey
ALTER TABLE "Tag" DROP CONSTRAINT "Tag_ownerId_fkey";

-- AlterTable
ALTER TABLE "GroupActivity" ADD COLUMN     "questionStackId" INTEGER;

-- AlterTable
ALTER TABLE "QuestionInstance" ADD COLUMN     "stackElementId" INTEGER;

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
CREATE UNIQUE INDEX "GroupActivity_questionStackId_key" ON "GroupActivity"("questionStackId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionInstance_stackElementId_key" ON "QuestionInstance"("stackElementId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionInstance_type_stackElementId_order_key" ON "QuestionInstance"("type", "stackElementId", "order");

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionInstance" ADD CONSTRAINT "QuestionInstance_stackElementId_fkey" FOREIGN KEY ("stackElementId") REFERENCES "StackElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionStack" ADD CONSTRAINT "QuestionStack_learningElementId_fkey" FOREIGN KEY ("learningElementId") REFERENCES "LearningElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StackElement" ADD CONSTRAINT "StackElement_stackId_fkey" FOREIGN KEY ("stackId") REFERENCES "QuestionStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivity" ADD CONSTRAINT "GroupActivity_questionStackId_fkey" FOREIGN KEY ("questionStackId") REFERENCES "QuestionStack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipationToQuestionStack" ADD CONSTRAINT "_ParticipationToQuestionStack_A_fkey" FOREIGN KEY ("A") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipationToQuestionStack" ADD CONSTRAINT "_ParticipationToQuestionStack_B_fkey" FOREIGN KEY ("B") REFERENCES "QuestionStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
