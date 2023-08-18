/*
  Warnings:

  - A unique constraint covering the columns `[originalId]` on the table `LiveSession` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[originalId]` on the table `Question` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[originalId]` on the table `QuestionInstance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[originalId]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[originalId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN     "originalId" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "originalId" TEXT;

-- AlterTable
ALTER TABLE "QuestionInstance" ADD COLUMN     "originalId" TEXT;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "originalId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "originalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_originalId_key" ON "LiveSession"("originalId");

-- CreateIndex
CREATE UNIQUE INDEX "Question_originalId_key" ON "Question"("originalId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionInstance_originalId_key" ON "QuestionInstance"("originalId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_originalId_key" ON "Tag"("originalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_originalId_key" ON "User"("originalId");
