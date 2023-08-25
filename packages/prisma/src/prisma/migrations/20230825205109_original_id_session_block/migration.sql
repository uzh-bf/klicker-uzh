/*
  Warnings:

  - A unique constraint covering the columns `[originalId]` on the table `SessionBlock` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Participant" ALTER COLUMN "isActive" SET DEFAULT true;

-- AlterTable
ALTER TABLE "SessionBlock" ADD COLUMN     "originalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SessionBlock_originalId_key" ON "SessionBlock"("originalId");
