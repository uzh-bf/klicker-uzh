/*
  Warnings:

  - A unique constraint covering the columns `[type,migrationId]` on the table `ElementInstance` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `migrationId` to the `ElementInstance` table without a default value. This is not possible if the table is not empty.
  - Made the column `migrationId` on table `ElementInstance` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ElementInstance" ADD COLUMN     "migrationId" INTEGER;

-- UpdateTable
UPDATE "ElementInstance"
SET "migrationId" = id
WHERE "migrationId" IS NULL;

-- AlterTable
ALTER TABLE "ElementInstance" ALTER COLUMN "migrationId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ElementInstance_type_migrationId_key" ON "ElementInstance"("type", "migrationId");
