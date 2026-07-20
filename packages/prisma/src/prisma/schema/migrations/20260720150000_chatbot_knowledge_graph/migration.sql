-- CreateEnum
CREATE TYPE "public"."ChatbotKnowledgeGraphStatus" AS ENUM ('EMPTY', 'DIRTY', 'QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."KBIngestionSpeedMode" AS ENUM ('BALANCED', 'QUALITY', 'FAST');

-- CreateTable
CREATE TABLE "public"."ChatbotKnowledgeGraph" (
    "id" UUID NOT NULL,
    "chatbotId" UUID NOT NULL,
    "status" "public"."ChatbotKnowledgeGraphStatus" NOT NULL DEFAULT 'EMPTY',
    "statusMessage" TEXT,
    "selectionRevision" INTEGER NOT NULL DEFAULT 0,
    "builtRevision" INTEGER,
    "activeAttemptId" UUID,
    "activeBuildRevision" INTEGER,
    "externalWorkflowRunId" TEXT,
    "externalStartedAt" TIMESTAMP(3),
    "lastBuiltAt" TIMESTAMP(3),
    "lastBuildSpeedMode" "public"."KBIngestionSpeedMode",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotKnowledgeGraph_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "public"."KBResource" ADD COLUMN "knowledgeGraphId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "ChatbotKnowledgeGraph_chatbotId_key" ON "public"."ChatbotKnowledgeGraph"("chatbotId");

-- CreateIndex
CREATE INDEX "ChatbotKnowledgeGraph_status_idx" ON "public"."ChatbotKnowledgeGraph"("status");

-- CreateIndex
CREATE INDEX "KBResource_knowledgeGraphId_idx" ON "public"."KBResource"("knowledgeGraphId");

-- AddForeignKey
ALTER TABLE "public"."ChatbotKnowledgeGraph" ADD CONSTRAINT "ChatbotKnowledgeGraph_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBResource" ADD CONSTRAINT "KBResource_knowledgeGraphId_fkey" FOREIGN KEY ("knowledgeGraphId") REFERENCES "public"."ChatbotKnowledgeGraph"("id") ON DELETE SET NULL ON UPDATE CASCADE;
