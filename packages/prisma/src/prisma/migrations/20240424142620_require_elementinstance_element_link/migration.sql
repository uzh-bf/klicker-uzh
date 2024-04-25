/*
  Warnings:

  - Made the column `elementId` on table `ElementInstance` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "ElementInstance" DROP CONSTRAINT "ElementInstance_elementId_fkey";

-- AlterTable
ALTER TABLE "ElementInstance" ALTER COLUMN "elementId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ElementInstance" ADD CONSTRAINT "ElementInstance_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
