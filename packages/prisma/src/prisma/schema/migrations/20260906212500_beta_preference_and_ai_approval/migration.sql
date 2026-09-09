-- AlterTable
ALTER TABLE "User" DROP COLUMN "aiChatbotPublishingEnabled",
ADD COLUMN     "betaEnabled" BOOLEAN NOT NULL DEFAULT true;
