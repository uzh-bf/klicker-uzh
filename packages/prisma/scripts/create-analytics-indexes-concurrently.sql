-- Executed statement-by-statement, outside a transaction, by
-- prepareAnalyticsIndexes.mjs. Do not run this file directly: the wrapper
-- detects invalid concurrent indexes and validates every result.

CREATE INDEX CONCURRENTLY IF NOT EXISTS "QuestionResponse_courseId_createdAt_idx"
ON "public"."QuestionResponse"("courseId", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_threadId_createdAt_idx"
ON "public"."ChatMessage"("threadId", "createdAt");

DROP INDEX CONCURRENTLY IF EXISTS "public"."ChatMessage_threadId_idx";

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ParticipantAnalytics_courseId_type_timestamp_idx"
ON "public"."ParticipantAnalytics"("courseId", "type", "timestamp");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AggregatedAnalytics_courseId_type_timestamp_idx"
ON "public"."AggregatedAnalytics"("courseId", "type", "timestamp");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "QuestionResponseDetail_createdAt_brin_idx"
ON "public"."QuestionResponseDetail" USING BRIN ("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "LiveQuizResponse_createdAt_brin_idx"
ON "public"."LiveQuizResponse" USING BRIN ("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "LiveQuizResponse_instanceId_participantId_submittedAt_idx"
ON "public"."LiveQuizResponse"("instanceId", "participantId", "submittedAt");
