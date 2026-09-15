-- CreateEnum
CREATE TYPE "AiSubscriptionTier" AS ENUM ('BASE', 'ADVANCED');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiSubscriptionTier" "AiSubscriptionTier" NOT NULL DEFAULT 'BASE';
