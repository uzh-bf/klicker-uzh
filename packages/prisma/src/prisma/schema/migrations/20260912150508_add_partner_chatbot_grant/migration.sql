-- CreateTable
CREATE TABLE "PartnerChatbotGrant" (
    "id" UUID NOT NULL,
    "partnerId" TEXT NOT NULL,
    "chatbotId" UUID NOT NULL,
    "grantedBy" UUID NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" UUID,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerChatbotGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PartnerChatbotGrant_chatbotId_idx" ON "PartnerChatbotGrant"("chatbotId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerChatbotGrant_partnerId_chatbotId_key" ON "PartnerChatbotGrant"("partnerId", "chatbotId");

-- AddForeignKey
ALTER TABLE "PartnerChatbotGrant" ADD CONSTRAINT "PartnerChatbotGrant_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
