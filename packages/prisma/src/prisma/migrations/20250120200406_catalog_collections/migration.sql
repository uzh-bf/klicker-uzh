-- AlterEnum
ALTER TYPE "AccessLevel" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "AnswerCollection" ADD COLUMN     "catalogCollectionId" UUID;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "catalogCollectionId" UUID;

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
