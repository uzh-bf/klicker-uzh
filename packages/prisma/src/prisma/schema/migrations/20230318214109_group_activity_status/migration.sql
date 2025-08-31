-- CreateEnum
CREATE TYPE "GroupActivityStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "GroupActivity" ADD COLUMN     "status" "GroupActivityStatus" NOT NULL DEFAULT 'DRAFT';
