-- CreateEnum
CREATE TYPE "public"."KBStatus" AS ENUM ('READY', 'INDEXING', 'QUEUED', 'STALE', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "public"."KBResourceKind" AS ENUM ('DOCUMENT', 'WEBSITE', 'SNIPPET', 'KLICKER_OBJECT');

-- CreateEnum
CREATE TYPE "public"."KBWebsiteStrategy" AS ENUM ('SCRAPE_SUBSITES', 'INDEX_PAGE', 'REFERENCE_ONLY');

-- CreateEnum
CREATE TYPE "public"."KBMetadataProfile" AS ENUM ('COURSE_KB', 'AI_BUDDY', 'AI_INFRA');

-- CreateEnum
CREATE TYPE "public"."KBGraphInclusionMode" AS ENUM ('INHERIT', 'INCLUDE', 'EXCLUDE');

-- CreateEnum
CREATE TYPE "public"."KBIngestionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."KB" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."KBStatus" NOT NULL DEFAULT 'READY',
    "statusMessage" TEXT,
    "metadataProfile" "public"."KBMetadataProfile" NOT NULL DEFAULT 'COURSE_KB',
    "metadata" JSONB,
    "settings" JSONB,
    "externalNamespaceId" TEXT,
    "externalVectorStoreId" TEXT,
    "externalGraphId" TEXT,
    "graphEnabled" BOOLEAN NOT NULL DEFAULT false,
    "graphResourceKinds" "public"."KBResourceKind"[] DEFAULT ARRAY[]::"public"."KBResourceKind"[],
    "resourceCount" INTEGER NOT NULL DEFAULT 0,
    "chunkCount" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" BIGINT,
    "refreshIntervalMinutes" INTEGER,
    "lastIndexedAt" TIMESTAMP(3),
    "nextRefreshAt" TIMESTAMP(3),
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KB_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KBResource" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" "public"."KBResourceKind" NOT NULL,
    "status" "public"."KBStatus" NOT NULL DEFAULT 'QUEUED',
    "statusDetail" TEXT,
    "graphInclusion" "public"."KBGraphInclusionMode" NOT NULL DEFAULT 'INHERIT',
    "metadata" JSONB,
    "refreshIntervalMinutes" INTEGER,
    "lastIndexedAt" TIMESTAMP(3),
    "nextRefreshAt" TIMESTAMP(3),
    "externalResourceId" TEXT,
    "websiteUrl" TEXT,
    "websiteStrategy" "public"."KBWebsiteStrategy",
    "snippetText" TEXT,
    "kbId" UUID NOT NULL,
    "elementId" INTEGER,
    "practiceQuizId" UUID,
    "liveQuizId" UUID,
    "microLearningId" UUID,
    "groupActivityId" UUID,
    "answerCollectionId" INTEGER,
    "mediaFileId" UUID,
    "deletedAt" TIMESTAMP(3),
    "deletedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KBIngestionRun" (
    "id" UUID NOT NULL,
    "status" "public"."KBIngestionStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "kbId" UUID NOT NULL,
    "resourceId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KBIngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KBWebhookInbox" (
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "KBWebhookInbox_pkey" PRIMARY KEY ("eventId")
);

-- CreateTable
CREATE TABLE "public"."KBCourse" (
    "id" UUID NOT NULL,
    "kbId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KBChatbot" (
    "id" UUID NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "kbId" UUID NOT NULL,
    "chatbotId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBChatbot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "KB_ownerId_status_idx" ON "public"."KB"("ownerId", "status");

-- CreateIndex
CREATE INDEX "KB_ownerId_metadataProfile_idx" ON "public"."KB"("ownerId", "metadataProfile");

-- CreateIndex
CREATE INDEX "KB_nextRefreshAt_idx" ON "public"."KB"("nextRefreshAt");

-- CreateIndex
CREATE INDEX "KB_graphEnabled_idx" ON "public"."KB"("graphEnabled");

-- CreateIndex
CREATE INDEX "KBResource_kbId_status_idx" ON "public"."KBResource"("kbId", "status");

-- CreateIndex
CREATE INDEX "KBResource_kbId_kind_idx" ON "public"."KBResource"("kbId", "kind");

-- CreateIndex
CREATE INDEX "KBResource_graphInclusion_idx" ON "public"."KBResource"("graphInclusion");

-- CreateIndex
CREATE INDEX "KBResource_nextRefreshAt_idx" ON "public"."KBResource"("nextRefreshAt");

-- CreateIndex
CREATE INDEX "KBResource_deletedAt_idx" ON "public"."KBResource"("deletedAt");

-- CreateIndex
CREATE INDEX "KBResource_elementId_idx" ON "public"."KBResource"("elementId");

-- CreateIndex
CREATE INDEX "KBResource_practiceQuizId_idx" ON "public"."KBResource"("practiceQuizId");

-- CreateIndex
CREATE INDEX "KBResource_liveQuizId_idx" ON "public"."KBResource"("liveQuizId");

-- CreateIndex
CREATE INDEX "KBResource_microLearningId_idx" ON "public"."KBResource"("microLearningId");

-- CreateIndex
CREATE INDEX "KBResource_groupActivityId_idx" ON "public"."KBResource"("groupActivityId");

-- CreateIndex
CREATE INDEX "KBResource_answerCollectionId_idx" ON "public"."KBResource"("answerCollectionId");

-- CreateIndex
CREATE INDEX "KBResource_mediaFileId_idx" ON "public"."KBResource"("mediaFileId");

-- CreateIndex
CREATE INDEX "KBResource_deletedById_idx" ON "public"."KBResource"("deletedById");

-- CreateIndex
CREATE INDEX "KBIngestionRun_kbId_createdAt_idx" ON "public"."KBIngestionRun"("kbId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "KBIngestionRun_resourceId_createdAt_idx" ON "public"."KBIngestionRun"("resourceId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "KBIngestionRun_status_idx" ON "public"."KBIngestionRun"("status");

-- CreateIndex
CREATE INDEX "KBWebhookInbox_receivedAt_idx" ON "public"."KBWebhookInbox"("receivedAt");

-- CreateIndex
CREATE INDEX "KBWebhookInbox_eventType_idx" ON "public"."KBWebhookInbox"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "KBCourse_kbId_courseId_key" ON "public"."KBCourse"("kbId", "courseId");

-- CreateIndex
CREATE INDEX "KBCourse_courseId_idx" ON "public"."KBCourse"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "KBChatbot_kbId_chatbotId_key" ON "public"."KBChatbot"("kbId", "chatbotId");

-- CreateIndex
CREATE INDEX "KBChatbot_chatbotId_idx" ON "public"."KBChatbot"("chatbotId");

-- CreateIndex
CREATE INDEX "KBChatbot_isEnabled_priority_idx" ON "public"."KBChatbot"("isEnabled", "priority");

-- AddForeignKey
ALTER TABLE "public"."KB" ADD CONSTRAINT "KB_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBResource" ADD CONSTRAINT "KBResource_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "public"."KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBResource" ADD CONSTRAINT "KBResource_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "public"."Element"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBResource" ADD CONSTRAINT "KBResource_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "public"."PracticeQuiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBResource" ADD CONSTRAINT "KBResource_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "public"."LiveQuiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBResource" ADD CONSTRAINT "KBResource_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "public"."MicroLearning"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBResource" ADD CONSTRAINT "KBResource_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "public"."GroupActivity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBResource" ADD CONSTRAINT "KBResource_answerCollectionId_fkey" FOREIGN KEY ("answerCollectionId") REFERENCES "public"."AnswerCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBResource" ADD CONSTRAINT "KBResource_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "public"."MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBResource" ADD CONSTRAINT "KBResource_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBIngestionRun" ADD CONSTRAINT "KBIngestionRun_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "public"."KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBIngestionRun" ADD CONSTRAINT "KBIngestionRun_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "public"."KBResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBCourse" ADD CONSTRAINT "KBCourse_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "public"."KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBCourse" ADD CONSTRAINT "KBCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBChatbot" ADD CONSTRAINT "KBChatbot_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "public"."KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBChatbot" ADD CONSTRAINT "KBChatbot_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
