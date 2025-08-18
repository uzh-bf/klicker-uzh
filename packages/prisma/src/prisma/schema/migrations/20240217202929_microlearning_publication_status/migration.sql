-- AlterTable
ALTER TABLE "MicroLearning" ADD COLUMN     "newStatus" "PublicationStatus";

-- Copy status value to newStatus
UPDATE "MicroLearning" SET "newStatus" = status::TEXT::"PublicationStatus";

-- AlterTable
ALTER TABLE "MicroLearning" DROP COLUMN     "status";

-- AlterTable
ALTER TABLE "MicroLearning" RENAME COLUMN "newStatus" TO "status";
