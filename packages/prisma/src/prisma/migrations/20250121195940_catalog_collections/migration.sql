/*
  Warnings:

  - The `access` column on the `AnswerCollection` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ObjectAccess" AS ENUM ('PUBLIC', 'PRIVATE', 'RESTRICTED');

-- AlterEnum
ALTER TYPE "AccessLevel" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "AnswerCollection" ADD COLUMN     "catalogCollectionId" UUID,
ADD COLUMN     "originalId" INTEGER,
DROP COLUMN "access",
ADD COLUMN     "access" "ObjectAccess" NOT NULL DEFAULT 'PRIVATE';

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "catalogCollectionId" UUID;

-- DropEnum
DROP TYPE "CollectionAccess";

-- CreateTable
CREATE TABLE "CatalogCollection" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCollection_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AnswerCollection" ADD CONSTRAINT "AnswerCollection_catalogCollectionId_fkey" FOREIGN KEY ("catalogCollectionId") REFERENCES "CatalogCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCollection" ADD CONSTRAINT "CatalogCollection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Permission" ADD CONSTRAINT "Permission_catalogCollectionId_fkey" FOREIGN KEY ("catalogCollectionId") REFERENCES "CatalogCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
