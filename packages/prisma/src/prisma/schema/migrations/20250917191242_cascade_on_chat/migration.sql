-- DropForeignKey
ALTER TABLE "public"."ChatThread" DROP CONSTRAINT "ChatThread_chatbotId_fkey";

-- DropForeignKey
ALTER TABLE "public"."ChatThread" DROP CONSTRAINT "ChatThread_participantId_fkey";

-- AddForeignKey
ALTER TABLE "public"."ChatThread" ADD CONSTRAINT "ChatThread_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ChatThread" ADD CONSTRAINT "ChatThread_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
