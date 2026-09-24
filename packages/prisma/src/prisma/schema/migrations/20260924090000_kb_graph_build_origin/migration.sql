-- CreateEnum
CREATE TYPE "KBGraphBuildOrigin" AS ENUM ('USER', 'SYSTEM');

-- AlterTable
ALTER TABLE "KBGraphBuild" ADD COLUMN     "origin" "KBGraphBuildOrigin" NOT NULL DEFAULT 'USER';
