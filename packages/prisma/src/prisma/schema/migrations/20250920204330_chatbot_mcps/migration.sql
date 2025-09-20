-- AlterTable
ALTER TABLE "public"."Chatbot" ADD COLUMN     "azureOpenAIEndpoint" TEXT,
ADD COLUMN     "azureOpenAIKey" TEXT;

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
