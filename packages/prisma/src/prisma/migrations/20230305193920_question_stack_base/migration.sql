/*
  Warnings:

  - You are about to drop the column `learningElementId` on the `QuestionInstance` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stackElementId]` on the table `QuestionInstance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[type,stackElementId,order]` on the table `QuestionInstance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "QuestionStackType" AS ENUM ('LEARNING_ELEMENT', 'MICRO_SESSION', 'LIVE_SESSION', 'GROUP_ACTIVITY');

-- DropForeignKey
ALTER TABLE "QuestionInstance" DROP CONSTRAINT "QuestionInstance_learningElementId_fkey";

-- DropIndex
DROP INDEX "QuestionInstance_type_learningElementId_order_key";

-- AlterTable
ALTER TABLE "QuestionInstance" DROP COLUMN "learningElementId",
ADD COLUMN     "stackElementId" INTEGER;

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

-- CreateIndex
CREATE UNIQUE INDEX "QuestionStack_type_learningElementId_order_key" ON "QuestionStack"("type", "learningElementId", "order");

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
