-- Mark Course.areAnalyticsValid + analyticsLastComputedAt for courses that have any
-- freshly-populated quiz-analytics row, and Course.chatAnalyticsValidAt only for
-- courses that have at least one ParticipantChatAnalytics row.
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
  "chatAnalyticsValidAt"    = CASE
    WHEN EXISTS (SELECT 1 FROM chat_courses cc WHERE cc."courseId" = c.id) THEN NOW()
    ELSE c."chatAnalyticsValidAt"
  END
WHERE EXISTS (SELECT 1 FROM quiz_courses qc WHERE qc."courseId" = c.id)
   OR EXISTS (SELECT 1 FROM chat_courses cc WHERE cc."courseId" = c.id);
