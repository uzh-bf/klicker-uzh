\set ON_ERROR_STOP on

-- Run this file with psql before Prisma deploys the analytics index migrations
-- to a shared environment. Do not wrap it in BEGIN / COMMIT.
--
-- IF NOT EXISTS also sees invalid indexes and would skip them, so abort until
-- the operator drops the exact invalid index concurrently.
SELECT EXISTS (
  SELECT 1
  FROM pg_index
  WHERE NOT indisvalid
    AND indexrelid::regclass::text IN (
      '"QuestionResponse_courseId_createdAt_idx"',
      '"ChatMessage_threadId_createdAt_idx"',
      '"ParticipantAnalytics_courseId_type_timestamp_idx"',
      '"AggregatedAnalytics_courseId_type_timestamp_idx"',
      '"QuestionResponseDetail_createdAt_brin_idx"',
      '"LiveQuizResponse_createdAt_brin_idx"',
      '"LiveQuizResponse_instanceId_submittedAt_idx"'
    )
) AS analytics_invalid_indexes \gset

\if :analytics_invalid_indexes
SELECT indexrelid::regclass AS invalid_index
FROM pg_index
WHERE NOT indisvalid
  AND indexrelid::regclass::text IN (
    '"QuestionResponse_courseId_createdAt_idx"',
    '"ChatMessage_threadId_createdAt_idx"',
    '"ParticipantAnalytics_courseId_type_timestamp_idx"',
    '"AggregatedAnalytics_courseId_type_timestamp_idx"',
    '"QuestionResponseDetail_createdAt_brin_idx"',
    '"LiveQuizResponse_createdAt_brin_idx"',
    '"LiveQuizResponse_instanceId_submittedAt_idx"'
  );
\echo 'Drop the listed invalid index concurrently, then rerun this file.'
\quit 3
\endif

DROP INDEX CONCURRENTLY IF EXISTS "public"."ChatMessage_threadId_idx";

CREATE INDEX CONCURRENTLY IF NOT EXISTS "QuestionResponse_courseId_createdAt_idx"
ON "public"."QuestionResponse"("courseId", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ChatMessage_threadId_createdAt_idx"
ON "public"."ChatMessage"("threadId", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "ParticipantAnalytics_courseId_type_timestamp_idx"
ON "public"."ParticipantAnalytics"("courseId", "type", "timestamp");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "AggregatedAnalytics_courseId_type_timestamp_idx"
ON "public"."AggregatedAnalytics"("courseId", "type", "timestamp");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "QuestionResponseDetail_createdAt_brin_idx"
ON "public"."QuestionResponseDetail" USING BRIN ("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "LiveQuizResponse_createdAt_brin_idx"
ON "public"."LiveQuizResponse" USING BRIN ("createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "LiveQuizResponse_instanceId_submittedAt_idx"
ON "public"."LiveQuizResponse"("instanceId", "submittedAt");
