-- CreateEnum
CREATE TYPE "KBGraphBuildOrigin" AS ENUM ('USER', 'SYSTEM');

-- AlterTable
ALTER TABLE "KB" ADD COLUMN     "graphSettingsChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "KBGraphBuild" ADD COLUMN     "origin" "KBGraphBuildOrigin" NOT NULL DEFAULT 'USER';

