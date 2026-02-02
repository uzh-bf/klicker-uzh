-- AlterTable
ALTER TABLE "public"."ChatMessage" ADD COLUMN     "chatMode" TEXT,
ADD COLUMN     "creditsUsed" DECIMAL(18,6),
ADD COLUMN     "modelId" TEXT;
