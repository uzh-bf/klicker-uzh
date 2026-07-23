-- Analytics pipeline covering + BRIN indexes (Phase A).
-- See project/ANALYTICS_IMPROVEMENTS.md §R4 for rationale.
-- Shared environments must first run
-- packages/prisma/scripts/create-analytics-indexes-concurrently.sql. These
-- retry-safe statements then become no-ops inside Prisma's transaction.

-- Replace standalone threadId index with composite (threadId, createdAt); composite covers threadId-only queries.
DROP INDEX IF EXISTS "public"."ChatMessage_threadId_idx";

-- B-tree composite indexes (Prisma @@index sourced).
CREATE INDEX IF NOT EXISTS "QuestionResponse_courseId_createdAt_idx" ON "public"."QuestionResponse"("courseId", "createdAt");
CREATE INDEX IF NOT EXISTS "ChatMessage_threadId_createdAt_idx" ON "public"."ChatMessage"("threadId", "createdAt");
CREATE INDEX IF NOT EXISTS "ParticipantAnalytics_courseId_type_timestamp_idx" ON "public"."ParticipantAnalytics"("courseId", "type", "timestamp");
CREATE INDEX IF NOT EXISTS "AggregatedAnalytics_courseId_type_timestamp_idx" ON "public"."AggregatedAnalytics"("courseId", "type", "timestamp");

-- BRIN indexes for append-mostly event tables — near-free storage, prunes by date range.
-- Prisma doesn't model BRIN natively, so these are raw-SQL only.
CREATE INDEX IF NOT EXISTS "QuestionResponseDetail_createdAt_brin_idx" ON "public"."QuestionResponseDetail" USING BRIN ("createdAt");
CREATE INDEX IF NOT EXISTS "LiveQuizResponse_createdAt_brin_idx" ON "public"."LiveQuizResponse" USING BRIN ("createdAt");
