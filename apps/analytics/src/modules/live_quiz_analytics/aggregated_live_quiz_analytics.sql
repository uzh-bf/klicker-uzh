-- AggregatedLiveQuizAnalytics: one row per assessment-mode LiveQuiz.
-- Late-submitter rate = fraction of participants whose first submission landed after LiveQuiz.finishedAt.

WITH assessment_responses AS (
  SELECT
    lq.id AS "liveQuizId",
    lq."courseId",
    lq."finishedAt",
    lqr.id,
    lqr."participantId",
    lqr."instanceId",
    lqr."submittedAt",
    lqr.correctness,
    ROW_NUMBER() OVER (
      PARTITION BY lqr."participantId", lqr."instanceId"
      ORDER BY lqr."submittedAt" ASC, lqr.id ASC
    ) AS attempt_asc,
    COUNT(*) OVER (
      PARTITION BY lqr."participantId", lqr."instanceId"
    ) AS attempt_count
  FROM "LiveQuizResponse" lqr
  JOIN "ElementInstance" ei ON ei.id = lqr."instanceId"
  JOIN "ElementBlock"    eb ON eb.id = ei."elementBlockId"
  JOIN "LiveQuiz"        lq ON lq.id = eb."liveQuizId"
  JOIN "Course"           c ON c.id = lq."courseId"
  JOIN "Participation"    p
    ON p."participantId" = lqr."participantId"
   AND p."courseId" = lq."courseId"
  WHERE lq."isAssessmentEnabled" = true
    AND lq."courseId" IS NOT NULL
    AND lqr."correctionOnly" = false
    AND c."isLearningAnalyticsEnabled" = true
    AND p."learningAnalyticsStatus" = 'INCLUDED'
    AND p."learningAnalyticsDisclosureVersion" = '2026-07-30-v1'
    AND p."learningAnalyticsIncludedFrom" IS NOT NULL
    AND lqr."submittedAt" >= p."learningAnalyticsIncludedFrom"
    /*COURSE_FILTER*/
),
participant_firsts AS (
  SELECT
    "liveQuizId",
    "participantId",
    MIN("submittedAt") AS first_submitted_at,
    MAX("finishedAt")  AS live_quiz_finished_at
  FROM assessment_responses
  GROUP BY "liveQuizId", "participantId"
),
rollup AS (
  SELECT
    "liveQuizId",
    "courseId",
    COUNT(DISTINCT "participantId") AS participant_count,
    COUNT(id) AS response_count,
    AVG(CASE WHEN attempt_asc = 1 THEN (correctness = 'CORRECT')::int END)::real
      AS mean_first_correctness,
    AVG(CASE WHEN attempt_asc = attempt_count THEN (correctness = 'CORRECT')::int END)::real
      AS mean_last_correctness
  FROM assessment_responses
  GROUP BY "liveQuizId", "courseId"
),
late_rate AS (
  SELECT
    "liveQuizId",
    AVG((
      live_quiz_finished_at IS NOT NULL
      AND first_submitted_at > live_quiz_finished_at
    )::int)::real AS late_submitter_rate
  FROM participant_firsts
  GROUP BY "liveQuizId"
)
INSERT INTO "AggregatedLiveQuizAnalytics" (
  "liveQuizId", "courseId",
  "participantCount", "responseCount",
  "meanFirstCorrectness", "meanLastCorrectness", "lateSubmitterRate",
  "createdAt", "updatedAt"
)
SELECT
  r."liveQuizId",
  r."courseId",
  r.participant_count,
  r.response_count,
  r.mean_first_correctness,
  r.mean_last_correctness,
  lr.late_submitter_rate,
  NOW(), NOW()
FROM rollup r
LEFT JOIN late_rate lr     USING ("liveQuizId")
ON CONFLICT ("liveQuizId") DO UPDATE SET
  "courseId"             = EXCLUDED."courseId",
  "participantCount"     = EXCLUDED."participantCount",
  "responseCount"        = EXCLUDED."responseCount",
  "meanFirstCorrectness" = EXCLUDED."meanFirstCorrectness",
  "meanLastCorrectness"  = EXCLUDED."meanLastCorrectness",
  "lateSubmitterRate"    = EXCLUDED."lateSubmitterRate",
  "updatedAt"            = NOW();
