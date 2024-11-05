/*
  Warnings:

  - A unique constraint covering the columns `[ownerId,originalId]` on the table `Element` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ownerId,originalId]` on the table `ElementInstance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ownerId,originalId]` on the table `LiveSession` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ownerId,originalId]` on the table `MediaFile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ownerId,originalId]` on the table `QuestionInstance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sessionId,originalId]` on the table `SessionBlock` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[ownerId,originalId]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Element_originalId_key";

-- DropIndex
DROP INDEX "ElementInstance_originalId_key";

-- DropIndex
DROP INDEX "LiveSession_originalId_key";

-- DropIndex
DROP INDEX "MediaFile_originalId_key";

-- DropIndex
DROP INDEX "QuestionInstance_originalId_key";

-- DropIndex
DROP INDEX "SessionBlock_originalId_key";

-- DropIndex
DROP INDEX "Tag_originalId_key";

-- CreateIndex
CREATE UNIQUE INDEX "Element_ownerId_originalId_key" ON "Element"("ownerId", "originalId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementInstance_ownerId_originalId_key" ON "ElementInstance"("ownerId", "originalId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveSession_ownerId_originalId_key" ON "LiveSession"("ownerId", "originalId");

-- CreateIndex
CREATE UNIQUE INDEX "MediaFile_ownerId_originalId_key" ON "MediaFile"("ownerId", "originalId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionInstance_ownerId_originalId_key" ON "QuestionInstance"("ownerId", "originalId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionBlock_sessionId_originalId_key" ON "SessionBlock"("sessionId", "originalId");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_ownerId_originalId_key" ON "Tag"("ownerId", "originalId");
