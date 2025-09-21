/*
  Warnings:

  - The primary key for the `ChatUsageCredits` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `id` on the `ChatUsageCredits` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."CreditResetPeriod" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'NONE');

-- DropIndex
DROP INDEX "public"."ChatUsageCredits_participantId_chatbotId_key";

-- AlterTable
ALTER TABLE "public"."ChatUsageCredits" DROP CONSTRAINT "ChatUsageCredits_pkey",
DROP COLUMN "id",
ADD COLUMN     "lastResetAt" TIMESTAMP(3),
ADD COLUMN     "periodStartedAt" TIMESTAMP(3),
ADD COLUMN     "resetCount" INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT "ChatUsageCredits_pkey" PRIMARY KEY ("participantId", "chatbotId");

-- AlterTable
ALTER TABLE "public"."Chatbot" ADD COLUMN     "azureOpenAIEndpoint" TEXT,
ADD COLUMN     "azureOpenAIKey" TEXT,
ADD COLUMN     "creditInitialCredits" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "creditMaxCredits" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "creditResetAmount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "creditResetPeriod" "public"."CreditResetPeriod" NOT NULL DEFAULT 'WEEKLY',
ADD COLUMN     "modelSelection" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."ChatbotMCPServer" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "authType" TEXT NOT NULL,
    "authSecret" TEXT,
    "passChatbotId" BOOLEAN NOT NULL DEFAULT false,
    "chatbotIdHeader" TEXT,
    "parameters" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotMCPServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChatbotMCPConfig" (
    "id" UUID NOT NULL,
    "chatbotId" UUID NOT NULL,
    "mcpServerId" UUID NOT NULL,
    "chatMode" TEXT NOT NULL,
    "allowedTools" JSONB,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "parameters" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotMCPConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatbotMCPServer_name_key" ON "public"."ChatbotMCPServer"("name");

-- CreateIndex
CREATE INDEX "ChatbotMCPConfig_chatbotId_chatMode_idx" ON "public"."ChatbotMCPConfig"("chatbotId", "chatMode");

-- CreateIndex
CREATE UNIQUE INDEX "ChatbotMCPConfig_chatbotId_mcpServerId_chatMode_key" ON "public"."ChatbotMCPConfig"("chatbotId", "mcpServerId", "chatMode");

-- AddForeignKey
ALTER TABLE "public"."ChatbotMCPConfig" ADD CONSTRAINT "ChatbotMCPConfig_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatbotMCPConfig" ADD CONSTRAINT "ChatbotMCPConfig_mcpServerId_fkey" FOREIGN KEY ("mcpServerId") REFERENCES "public"."ChatbotMCPServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
