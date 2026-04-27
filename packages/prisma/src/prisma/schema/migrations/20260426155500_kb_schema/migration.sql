-- CreateEnum
CREATE TYPE "public"."KBStatus" AS ENUM ('READY', 'INDEXING', 'CRAWLING', 'QUEUED', 'STALE', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "public"."KBResourceStatus" AS ENUM ('READY', 'INDEXING', 'CRAWLING', 'QUEUED', 'STALE', 'ERROR', 'DISABLED');

-- CreateEnum
CREATE TYPE "public"."KBResourceKind" AS ENUM ('DOCUMENT', 'WEBSITE', 'SNIPPET', 'KLICKER_OBJECT');

-- CreateEnum
CREATE TYPE "public"."KBWebsiteStrategy" AS ENUM ('SCRAPE_SUBSITES', 'INDEX_PAGE', 'REFERENCE_ONLY');

-- CreateEnum
CREATE TYPE "public"."KBRefreshMode" AS ENUM ('INHERIT', 'MANUAL', 'INTERVAL', 'CRON', 'DISABLED');

-- CreateEnum
CREATE TYPE "public"."KBRefreshScope" AS ENUM ('ALL', 'WEBSITES', 'REFRESHABLE');

-- CreateEnum
CREATE TYPE "public"."KBMetadataProfile" AS ENUM ('COURSE_KB', 'AI_BUDDY', 'AI_INFRA');

-- CreateEnum
CREATE TYPE "public"."KBIngestionTrigger" AS ENUM ('MANUAL', 'SCHEDULED', 'RESOURCE_CREATED', 'RESOURCE_UPDATED', 'REFRESH_POLICY', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "public"."KBIngestionStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "public"."KBGraphInclusionMode" AS ENUM ('INHERIT', 'INCLUDE', 'EXCLUDE');

-- CreateEnum
CREATE TYPE "public"."KBWebhookDirection" AS ENUM ('OUTGOING', 'INCOMING');

-- CreateEnum
CREATE TYPE "public"."KBWebhookStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "public"."KBWebhookDestination" AS ENUM ('INGESTION', 'GRAPH');

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
    "entityCount" INTEGER NOT NULL DEFAULT 0,
    "sizeBytes" BIGINT,
    "refreshMode" "public"."KBRefreshMode" NOT NULL DEFAULT 'MANUAL',
    "refreshScope" "public"."KBRefreshScope" NOT NULL DEFAULT 'REFRESHABLE',
    "refreshIntervalMinutes" INTEGER,
    "refreshCron" TEXT,
    "changeMonitoring" BOOLEAN NOT NULL DEFAULT false,
    "lastIndexedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastContentChangedAt" TIMESTAMP(3),
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
    "status" "public"."KBResourceStatus" NOT NULL DEFAULT 'QUEUED',
    "statusLabel" TEXT,
    "statusDetail" TEXT,
    "progress" INTEGER,
    "originLabel" TEXT,
    "originDetail" TEXT,
    "sizeBytes" BIGINT,
    "chunkCount" INTEGER,
    "entityCount" INTEGER,
    "externalResourceId" TEXT,
    "externalIndexId" TEXT,
    "sourceHash" TEXT,
    "contentHash" TEXT,
    "graphInclusion" "public"."KBGraphInclusionMode" NOT NULL DEFAULT 'INHERIT',
    "metadata" JSONB,
    "lastIndexedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "lastRemoteModifiedAt" TIMESTAMP(3),
    "lastContentChangedAt" TIMESTAMP(3),
    "nextRefreshAt" TIMESTAMP(3),
    "changeStatus" TEXT,
    "refreshMode" "public"."KBRefreshMode" NOT NULL DEFAULT 'INHERIT',
    "refreshScope" "public"."KBRefreshScope",
    "refreshIntervalMinutes" INTEGER,
    "refreshCron" TEXT,
    "changeMonitoring" BOOLEAN,
    "documentFileName" TEXT,
    "documentMimeType" TEXT,
    "documentPageCount" INTEGER,
    "documentLanguage" TEXT,
    "websiteUrl" TEXT,
    "websiteStrategy" "public"."KBWebsiteStrategy",
    "sitemapFound" BOOLEAN,
    "sitemapPageCount" INTEGER,
    "scrapedPageCount" INTEGER,
    "crawlDepth" INTEGER,
    "snippetText" TEXT,
    "snippetCharacterCount" INTEGER,
    "snippetLanguage" TEXT,
    "snippetAuthor" TEXT,
    "snippetNote" TEXT,
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
CREATE TABLE "public"."KBWebsiteSubresource" (
    "id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT,
    "status" "public"."KBResourceStatus" NOT NULL DEFAULT 'QUEUED',
    "statusDetail" TEXT,
    "chunkCount" INTEGER,
    "sourceHash" TEXT,
    "contentHash" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "lastRemoteModifiedAt" TIMESTAMP(3),
    "lastContentChangedAt" TIMESTAMP(3),
    "resourceId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBWebsiteSubresource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KBIngestionRun" (
    "id" UUID NOT NULL,
    "trigger" "public"."KBIngestionTrigger" NOT NULL,
    "status" "public"."KBIngestionStatus" NOT NULL DEFAULT 'QUEUED',
    "hatchetTaskId" TEXT,
    "externalRunId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "stats" JSONB,
    "errorMessage" TEXT,
    "errorDetails" TEXT,
    "kbId" UUID NOT NULL,
    "resourceId" UUID,
    "requestedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBIngestionRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."KBWebhookEvent" (
    "id" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "direction" "public"."KBWebhookDirection" NOT NULL,
    "eventType" TEXT NOT NULL,
    "status" "public"."KBWebhookStatus" NOT NULL,
    "destination" "public"."KBWebhookDestination" NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "kbId" UUID,
    "resourceId" UUID,
    "ingestionRunId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBWebhookEvent_pkey" PRIMARY KEY ("id")
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
CREATE INDEX "KB_status_idx" ON "public"."KB"("status");

-- CreateIndex
CREATE INDEX "KB_metadataProfile_idx" ON "public"."KB"("metadataProfile");

-- CreateIndex
CREATE INDEX "KB_nextRefreshAt_idx" ON "public"."KB"("nextRefreshAt");

-- CreateIndex
CREATE INDEX "KB_graphEnabled_idx" ON "public"."KB"("graphEnabled");

-- CreateIndex
CREATE INDEX "KBResource_kbId_status_idx" ON "public"."KBResource"("kbId", "status");

-- CreateIndex
CREATE INDEX "KBResource_kbId_kind_idx" ON "public"."KBResource"("kbId", "kind");

-- CreateIndex
CREATE INDEX "KBResource_kind_status_idx" ON "public"."KBResource"("kind", "status");

-- CreateIndex
CREATE INDEX "KBResource_graphInclusion_idx" ON "public"."KBResource"("graphInclusion");

-- CreateIndex
CREATE INDEX "KBResource_nextRefreshAt_idx" ON "public"."KBResource"("nextRefreshAt");

-- CreateIndex
CREATE INDEX "KBResource_deletedAt_idx" ON "public"."KBResource"("deletedAt");

-- CreateIndex
CREATE INDEX "KBResource_websiteUrl_idx" ON "public"."KBResource"("websiteUrl");

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
CREATE UNIQUE INDEX "KBWebsiteSubresource_resourceId_url_key" ON "public"."KBWebsiteSubresource"("resourceId", "url");

-- CreateIndex
CREATE INDEX "KBWebsiteSubresource_resourceId_status_idx" ON "public"."KBWebsiteSubresource"("resourceId", "status");

-- CreateIndex
CREATE INDEX "KBWebsiteSubresource_url_idx" ON "public"."KBWebsiteSubresource"("url");

-- CreateIndex
CREATE INDEX "KBIngestionRun_kbId_status_idx" ON "public"."KBIngestionRun"("kbId", "status");

-- CreateIndex
CREATE INDEX "KBIngestionRun_resourceId_status_idx" ON "public"."KBIngestionRun"("resourceId", "status");

-- CreateIndex
CREATE INDEX "KBIngestionRun_status_createdAt_idx" ON "public"."KBIngestionRun"("status", "createdAt");

-- CreateIndex
CREATE INDEX "KBIngestionRun_hatchetTaskId_idx" ON "public"."KBIngestionRun"("hatchetTaskId");

-- CreateIndex
CREATE INDEX "KBIngestionRun_externalRunId_idx" ON "public"."KBIngestionRun"("externalRunId");

-- CreateIndex
CREATE INDEX "KBIngestionRun_requestedById_idx" ON "public"."KBIngestionRun"("requestedById");

-- CreateIndex
CREATE UNIQUE INDEX "KBWebhookEvent_eventId_key" ON "public"."KBWebhookEvent"("eventId");

-- CreateIndex
CREATE INDEX "KBWebhookEvent_kbId_status_idx" ON "public"."KBWebhookEvent"("kbId", "status");

-- CreateIndex
CREATE INDEX "KBWebhookEvent_resourceId_status_idx" ON "public"."KBWebhookEvent"("resourceId", "status");

-- CreateIndex
CREATE INDEX "KBWebhookEvent_ingestionRunId_idx" ON "public"."KBWebhookEvent"("ingestionRunId");

-- CreateIndex
CREATE INDEX "KBWebhookEvent_direction_destination_status_idx" ON "public"."KBWebhookEvent"("direction", "destination", "status");

-- CreateIndex
CREATE INDEX "KBWebhookEvent_eventType_idx" ON "public"."KBWebhookEvent"("eventType");

-- CreateIndex
CREATE INDEX "KBWebhookEvent_lastAttemptAt_idx" ON "public"."KBWebhookEvent"("lastAttemptAt");

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
ALTER TABLE "public"."KBWebsiteSubresource" ADD CONSTRAINT "KBWebsiteSubresource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "public"."KBResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBIngestionRun" ADD CONSTRAINT "KBIngestionRun_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "public"."KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBIngestionRun" ADD CONSTRAINT "KBIngestionRun_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "public"."KBResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBIngestionRun" ADD CONSTRAINT "KBIngestionRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBWebhookEvent" ADD CONSTRAINT "KBWebhookEvent_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "public"."KB"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBWebhookEvent" ADD CONSTRAINT "KBWebhookEvent_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "public"."KBResource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBWebhookEvent" ADD CONSTRAINT "KBWebhookEvent_ingestionRunId_fkey" FOREIGN KEY ("ingestionRunId") REFERENCES "public"."KBIngestionRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBCourse" ADD CONSTRAINT "KBCourse_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "public"."KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBCourse" ADD CONSTRAINT "KBCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBChatbot" ADD CONSTRAINT "KBChatbot_kbId_fkey" FOREIGN KEY ("kbId") REFERENCES "public"."KB"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."KBChatbot" ADD CONSTRAINT "KBChatbot_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "public"."Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
