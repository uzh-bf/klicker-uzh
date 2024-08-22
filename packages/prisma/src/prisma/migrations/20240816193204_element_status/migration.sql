-- CreateEnum
CREATE TYPE "ElementStatus" AS ENUM ('DRAFT', 'REVIEW', 'READY');

-- AlterTable
ALTER TABLE "Element" ADD COLUMN     "status" "ElementStatus" NOT NULL DEFAULT 'READY';
