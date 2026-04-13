-- AlterTable
ALTER TABLE "public"."ChatMessage" ADD COLUMN     "chatMode" TEXT,
ADD COLUMN     "creditsUsed" DECIMAL(18,6),
ADD COLUMN     "modelId" TEXT,
ADD COLUMN     "reasoningContent" TEXT,
ADD COLUMN     "reasoningEffort" TEXT;

-- AlterTable
ALTER TABLE "public"."Chatbot" ADD COLUMN     "allowedModelIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "allowedReasoningEffortsByModel" JSONB;
