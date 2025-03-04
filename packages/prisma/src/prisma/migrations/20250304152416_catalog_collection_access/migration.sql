-- DropForeignKey
ALTER TABLE "CatalogCollection" DROP CONSTRAINT "CatalogCollection_ownerId_fkey";

-- AlterTable
ALTER TABLE "CatalogCollection" ADD COLUMN     "access" "ObjectAccess" NOT NULL DEFAULT 'RESTRICTED';

-- AddForeignKey
ALTER TABLE "CatalogCollection" ADD CONSTRAINT "CatalogCollection_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update Custom Constraint on Permissions Table
ALTER TABLE "Permission" DROP CONSTRAINT "ObjectRequired";
ALTER TABLE "Permission" ADD CONSTRAINT "ObjectRequired" CHECK (
  ("answerCollectionId" IS NOT NULL) OR 
  ("elementId" IS NOT NULL) OR 
  ("courseId" IS NOT NULL) OR 
  ("liveQuizId" IS NOT NULL) OR 
  ("practiceQuizId" IS NOT NULL) OR 
  ("microLearningId" IS NOT NULL) OR 
  ("groupActivityId" IS NOT NULL) OR
  ("catalogCollectionId" IS NOT NULL)
);