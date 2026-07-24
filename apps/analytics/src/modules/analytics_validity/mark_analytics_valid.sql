-- Mark Course.areAnalyticsValid + analyticsLastComputedAt for courses covered by
-- fresh analytics. Scoped runs also stamp a valid empty chat result; unscoped
-- runs stamp Course.chatAnalyticsValidAt only for courses with chat rows.
--
-- When the pipeline runs in finalize mode, the handler injects an
-- ``AND c.id IN (<csv>)`` clause into /*COURSE_FINALIZE_FILTER*/ and turns
-- /*COURSE_FINALIZE_SET*/ into ``"analyticsFinalizedAt" = NOW(),``. In the
-- default (incremental / full) mode the placeholders are empty and only the
-- live watermarks are updated.
--
-- Run as the last step of the analytics pipeline (per §3.8). Idempotent.

WITH quiz_courses AS (
  SELECT DISTINCT "courseId" FROM "ParticipantAnalytics"
),
chat_courses AS (
  SELECT DISTINCT "courseId" FROM "ParticipantChatAnalytics"
)
UPDATE "Course" c SET
  "areAnalyticsValid"       = true,
  "analyticsLastComputedAt" = NOW(),
  /*COURSE_FINALIZE_SET*/
  "chatAnalyticsValidAt"    = CASE
    WHEN /*COURSE_SCOPE_BYPASS*/
      OR EXISTS (SELECT 1 FROM chat_courses cc WHERE cc."courseId" = c.id)
      THEN COALESCE(CAST(:chat_analytics_cutoff AS timestamptz), NOW())
    ELSE c."chatAnalyticsValidAt"
  END
WHERE (EXISTS (SELECT 1 FROM quiz_courses qc WHERE qc."courseId" = c.id)
   OR EXISTS (SELECT 1 FROM chat_courses cc WHERE cc."courseId" = c.id)
   OR /*COURSE_SCOPE_BYPASS*/)
  /*COURSE_FINALIZE_FILTER*/;
