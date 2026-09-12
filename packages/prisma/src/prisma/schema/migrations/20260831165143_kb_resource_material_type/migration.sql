-- CreateEnum
CREATE TYPE "KBResourceMaterialType" AS ENUM ('UNCLASSIFIED', 'COURSE_CONTENT', 'ADMINISTRATIVE');

-- AlterTable
ALTER TABLE "KBResource" ADD COLUMN "materialType" "KBResourceMaterialType" NOT NULL DEFAULT 'UNCLASSIFIED';
