-- CreateEnum
CREATE TYPE "ElementStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'READY');

-- AlterTable
ALTER TABLE "Element" ADD COLUMN     "status" "ElementStatus" NOT NULL DEFAULT 'DRAFT';
