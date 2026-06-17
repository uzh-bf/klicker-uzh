-- CreateTable
CREATE TABLE "public"."TutorSkillPack" (
    "id" UUID NOT NULL,
    "version" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "baseMode" TEXT NOT NULL DEFAULT 'tutor',
    "prompt" TEXT NOT NULL,
    "policy" JSONB,
    "publishedAt" TIMESTAMP(3),
    "chatbotId" UUID,
    "courseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorSkillPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TutorKnowledgeComponent" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "prerequisites" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorKnowledgeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TutorMisconception" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "symptoms" JSONB NOT NULL,
    "nearMisses" JSONB,
    "diagnosticQuestion" TEXT,
    "correctiveMove" TEXT,
    "evidenceLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "courseId" UUID NOT NULL,
    "skillId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorMisconception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TutorHintLadder" (
    "id" UUID NOT NULL,
    "levels" JSONB NOT NULL,
    "maxDepth" INTEGER NOT NULL,
    "courseId" UUID NOT NULL,
    "skillId" UUID,
    "misconceptionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorHintLadder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TutorLearnerState" (
    "id" UUID NOT NULL,
    "state" JSONB NOT NULL,
    "participantId" UUID NOT NULL,
    "chatbotId" UUID NOT NULL,
    "courseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TutorLearnerState_pkey" PRIMARY KEY ("id")
);

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
CREATE UNIQUE INDEX "TutorSkillPack_chatbotId_baseMode_version_key" ON "public"."TutorSkillPack"("chatbotId", "baseMode", "version");

-- CreateIndex
CREATE INDEX "TutorSkillPack_courseId_status_idx" ON "public"."TutorSkillPack"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TutorKnowledgeComponent_courseId_slug_key" ON "public"."TutorKnowledgeComponent"("courseId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "TutorMisconception_courseId_label_key" ON "public"."TutorMisconception"("courseId", "label");

-- CreateIndex
CREATE INDEX "TutorMisconception_courseId_status_idx" ON "public"."TutorMisconception"("courseId", "status");

-- CreateIndex
CREATE INDEX "TutorMisconception_skillId_idx" ON "public"."TutorMisconception"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "TutorHintLadder_courseId_skillId_misconceptionId_key" ON "public"."TutorHintLadder"("courseId", "skillId", "misconceptionId");

-- CreateIndex
CREATE INDEX "TutorHintLadder_courseId_idx" ON "public"."TutorHintLadder"("courseId");

-- CreateIndex
CREATE INDEX "TutorHintLadder_skillId_idx" ON "public"."TutorHintLadder"("skillId");

-- CreateIndex
CREATE INDEX "TutorHintLadder_misconceptionId_idx" ON "public"."TutorHintLadder"("misconceptionId");

-- CreateIndex
CREATE UNIQUE INDEX "TutorLearnerState_participantId_chatbotId_key" ON "public"."TutorLearnerState"("participantId", "chatbotId");

-- CreateIndex
CREATE INDEX "TutorLearnerState_chatbotId_idx" ON "public"."TutorLearnerState"("chatbotId");

-- CreateIndex
CREATE INDEX "TutorLearnerState_courseId_idx" ON "public"."TutorLearnerState"("courseId");

-- CreateIndex
CREATE INDEX "TutorEvent_chatbotId_eventType_createdAt_idx" ON "public"."TutorEvent"("chatbotId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "TutorEvent_participantId_chatbotId_createdAt_idx" ON "public"."TutorEvent"("participantId", "chatbotId", "createdAt");

-- CreateIndex
CREATE INDEX "TutorEvent_threadId_idx" ON "public"."TutorEvent"("threadId");

-- CreateIndex
CREATE INDEX "TutorEvent_messageId_idx" ON "public"."TutorEvent"("messageId");

-- AddForeignKey
ALTER TABLE "public"."TutorSkillPack" ADD CONSTRAINT "TutorSkillPack_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorSkillPack" ADD CONSTRAINT "TutorSkillPack_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorKnowledgeComponent" ADD CONSTRAINT "TutorKnowledgeComponent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorMisconception" ADD CONSTRAINT "TutorMisconception_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorMisconception" ADD CONSTRAINT "TutorMisconception_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "public"."TutorKnowledgeComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorHintLadder" ADD CONSTRAINT "TutorHintLadder_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorHintLadder" ADD CONSTRAINT "TutorHintLadder_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "public"."TutorKnowledgeComponent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorHintLadder" ADD CONSTRAINT "TutorHintLadder_misconceptionId_fkey" FOREIGN KEY ("misconceptionId") REFERENCES "public"."TutorMisconception"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorLearnerState" ADD CONSTRAINT "TutorLearnerState_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorLearnerState" ADD CONSTRAINT "TutorLearnerState_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorLearnerState" ADD CONSTRAINT "TutorLearnerState_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorEvent" ADD CONSTRAINT "TutorEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorEvent" ADD CONSTRAINT "TutorEvent_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorEvent" ADD CONSTRAINT "TutorEvent_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."ChatThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TutorEvent" ADD CONSTRAINT "TutorEvent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "public"."ChatMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
