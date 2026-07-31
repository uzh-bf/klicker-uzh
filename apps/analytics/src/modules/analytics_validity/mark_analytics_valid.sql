-- Mark Course.areAnalyticsValid + analyticsLastComputedAt for courses covered by
-- fresh analytics. Scoped runs also stamp a valid empty chat result; unscoped
-- runs stamp Course.chatAnalyticsValidAt only for courses with chat rows.
--
-- When the pipeline runs in finalize mode, the handler injects an
-- ``AND c.id IN (<csv>)`` clause into /*COURSE_FINALIZE_FILTER*/. Finalization
-- stays pending when LA eligibility changed after this workflow's immutable cutoff.
-- In incremental / full mode the finalize placeholder is empty.
--
-- Run as the last step of the analytics pipeline (per §3.8). Idempotent.

WITH quiz_courses AS (
  SELECT DISTINCT "courseId" FROM "ParticipantAnalytics"
),
chat_courses AS (
  SELECT DISTINCT "courseId" FROM "ParticipantChatAnalytics"
),
pending_eligibility_changes AS (
  SELECT c.id AS "courseId"
  FROM "Course" c
  WHERE c."updatedAt"
        > CAST(:chat_analytics_cutoff AS timestamptz) AT TIME ZONE 'UTC'

  UNION

  SELECT DISTINCT p."courseId"
  FROM "LearningAnalyticsChoiceEvent" choice
  JOIN "Participation" p ON p.id = choice."participationId"
  WHERE choice."createdAt"
        > CAST(:chat_analytics_cutoff AS timestamptz) AT TIME ZONE 'UTC'
),
pending_chat_changes AS (
  SELECT DISTINCT pending."courseId"
  FROM pending_eligibility_changes pending
  WHERE true
  /*PENDING_CHAT_COURSE_FILTER*/
)
UPDATE "Course" c SET
  "areAnalyticsValid"       = true,
  "analyticsLastComputedAt" = NOW(),
  /*COURSE_FINALIZE_SET*/
  "chatAnalyticsValidAt"    = CASE
    WHEN /*COURSE_SCOPE_BYPASS*/
      OR EXISTS (SELECT 1 FROM chat_courses cc WHERE cc."courseId" = c.id)
      THEN CAST(:chat_analytics_cutoff AS timestamptz) AT TIME ZONE 'UTC'
    ELSE c."chatAnalyticsValidAt"
  END
WHERE (EXISTS (SELECT 1 FROM quiz_courses qc WHERE qc."courseId" = c.id)
   OR EXISTS (SELECT 1 FROM chat_courses cc WHERE cc."courseId" = c.id)
   OR /*COURSE_SCOPE_BYPASS*/)
  AND c."isLearningAnalyticsEnabled" = true
  /*COURSE_FINALIZE_FILTER*/;
