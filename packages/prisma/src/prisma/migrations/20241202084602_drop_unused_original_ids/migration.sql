/*
  Warnings:

  - You are about to drop the column `originalId` on the `ElementBlock` table. All the data in the column will be lost.
  - You are about to drop the column `originalId` on the `ElementInstance` table. All the data in the column will be lost.
  - You are about to drop the column `originalId` on the `Tag` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "ElementInstance_ownerId_originalId_key";

-- DropIndex
DROP INDEX "Tag_ownerId_originalId_key";

-- AlterTable
ALTER TABLE "ElementBlock" DROP COLUMN "originalId";

-- AlterTable
ALTER TABLE "ElementInstance" DROP COLUMN "originalId";

-- AlterTable
ALTER TABLE "Tag" DROP COLUMN "originalId";
