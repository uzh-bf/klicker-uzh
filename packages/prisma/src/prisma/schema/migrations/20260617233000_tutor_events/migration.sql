-- CreateTable
CREATE TABLE "public"."TutorEvent" (
    "id" UUID NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "participantId" UUID,
    "chatbotId" UUID NOT NULL,
    "threadId" UUID,
    "messageId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TutorEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TutorEvent_chatbotId_eventType_createdAt_idx" ON "public"."TutorEvent"("chatbotId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "TutorEvent_participantId_chatbotId_createdAt_idx" ON "public"."TutorEvent"("participantId", "chatbotId", "createdAt");

-- CreateIndex
CREATE INDEX "TutorEvent_threadId_idx" ON "public"."TutorEvent"("threadId");

-- CreateIndex
CREATE INDEX "TutorEvent_messageId_idx" ON "public"."TutorEvent"("messageId");

-- AddForeignKey
ALTER TABLE "public"."TutorEvent" ADD CONSTRAINT "TutorEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorEvent" ADD CONSTRAINT "TutorEvent_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorEvent" ADD CONSTRAINT "TutorEvent_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorEvent" ADD CONSTRAINT "TutorEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
