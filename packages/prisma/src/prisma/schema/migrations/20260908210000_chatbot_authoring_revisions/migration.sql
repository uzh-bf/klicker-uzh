-- AlterTable
ALTER TABLE "Chatbot" ADD COLUMN     "creditResetPeriodChangedAt" TIMESTAMP(3),
ADD COLUMN     "draftConfig" JSONB,
ADD COLUMN     "revisionStatus" "ChatbotStatus",
ADD COLUMN     "revisionVersion" INTEGER NOT NULL DEFAULT 0;
