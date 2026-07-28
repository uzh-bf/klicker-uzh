-- CreateTable
CREATE TABLE "public"."KBChatbot" (
    "id" UUID NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "kbId" UUID NOT NULL,
    "chatbotId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBChatbot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KBChatbot_kbId_chatbotId_key" ON "public"."KBChatbot"("kbId", "chatbotId");

-- CreateIndex
CREATE INDEX "KBChatbot_chatbotId_idx" ON "public"."KBChatbot"("chatbotId");

-- Enforce the product invariant even across concurrent writers.
CREATE UNIQUE INDEX "KBChatbot_one_enabled_per_chatbot_key"
ON "public"."KBChatbot"("chatbotId")
WHERE "isEnabled" = true;

-- AddForeignKey
ALTER TABLE "public"."KBChatbot" ADD CONSTRAINT "KBChatbot_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "public"."KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBChatbot" ADD CONSTRAINT "KBChatbot_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
