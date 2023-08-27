/*
  Warnings:

  - A unique constraint covering the columns `[originalId]` on the table `MediaFile` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MediaFile" ADD COLUMN     "originalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MediaFile_originalId_key" ON "MediaFile"("originalId");
