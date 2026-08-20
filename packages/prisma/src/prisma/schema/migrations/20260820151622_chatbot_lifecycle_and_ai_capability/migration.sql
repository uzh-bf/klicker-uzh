-- CreateEnum
CREATE TYPE "ChatbotStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'PAUSED', 'REJECTED');

-- AlterTable
ALTER TABLE "Chatbot" ADD COLUMN     "expectedStudentCount" INTEGER,
ADD COLUMN     "publicationUseCase" TEXT,
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "reviewComment" TEXT,
ADD COLUMN     "status" "ChatbotStatus" NOT NULL DEFAULT 'DRAFT';

-- Backfill: every chatbot that existed before this migration is already live for
-- participants, so publish it. The DEFAULT 'DRAFT' above applies only to rows
-- inserted after this point (new self-service chatbots start as drafts).
UPDATE "Chatbot" SET "status" = 'PUBLISHED';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiChatbotCostCenter" TEXT,
ADD COLUMN     "aiChatbotPublishingEnabled" BOOLEAN NOT NULL DEFAULT false;
