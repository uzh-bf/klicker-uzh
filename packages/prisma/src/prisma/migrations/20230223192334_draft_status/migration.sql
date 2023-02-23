-- CreateEnum
CREATE TYPE "LearningElementStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "MicroSessionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- AlterTable
ALTER TABLE "LearningElement" ADD COLUMN     "status" "LearningElementStatus" NOT NULL DEFAULT 'PUBLISHED';

-- AlterTable
ALTER TABLE "MicroSession" ADD COLUMN     "status" "MicroSessionStatus" NOT NULL DEFAULT 'PUBLISHED';
