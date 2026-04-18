-- AggregatedLiveQuizAnalytics: one row per assessment-mode LiveQuiz.
-- Late-submitter rate = fraction of participants whose first submission landed after LiveQuiz.finishedAt.

WITH assessment_live_quizzes AS (
  SELECT id, "courseId", "finishedAt"
  FROM "LiveQuiz" lq
  WHERE "isAssessmentEnabled" = true AND "courseId" IS NOT NULL
    /*COURSE_FILTER*/
),
participant_firsts AS (
  SELECT
    lq.id AS "liveQuizId",
    lqr."participantId",
    MIN(lqr."submittedAt") AS first_submitted_at,
    MAX(lq."finishedAt")   AS live_quiz_finished_at
  FROM assessment_live_quizzes lq
  JOIN "ElementBlock"    eb  ON eb."liveQuizId" = lq.id
  JOIN "ElementInstance" ei  ON ei."elementBlockId" = eb.id
  JOIN "LiveQuizResponse" lqr ON lqr."instanceId" = ei.id
  WHERE lqr."correctionOnly" = false
  GROUP BY lq.id, lqr."participantId"
),
rollup AS (
  SELECT
    lq.id                                                                              AS "liveQuizId",
    lq."courseId",
    COUNT(DISTINCT lqr."participantId")                                                AS participant_count,
    COUNT(lqr.id)                                                                      AS response_count,
    AVG(CASE WHEN lqr.correctness = 'CORRECT' THEN 1.0 ELSE 0.0 END)::real             AS mean_last_correctness
  FROM assessment_live_quizzes lq
  JOIN "ElementBlock"    eb  ON eb."liveQuizId" = lq.id
  JOIN "ElementInstance" ei  ON ei."elementBlockId" = eb.id
  JOIN "LiveQuizResponse" lqr ON lqr."instanceId" = ei.id
  WHERE lqr."correctionOnly" = false
  GROUP BY lq.id, lq."courseId"
),
first_correct AS (
  -- first-submission correctness per (participant, instance)
  SELECT lq.id AS "liveQuizId",
         AVG(CASE WHEN first_correctness = 'CORRECT' THEN 1.0 ELSE 0.0 END)::real AS mean_first_correctness
  FROM assessment_live_quizzes lq
  JOIN "ElementBlock"    eb  ON eb."liveQuizId" = lq.id
  JOIN "ElementInstance" ei  ON ei."elementBlockId" = eb.id
  JOIN LATERAL (
    SELECT lqr.correctness AS first_correctness
    FROM "LiveQuizResponse" lqr
    WHERE lqr."instanceId" = ei.id AND lqr."correctionOnly" = false
    ORDER BY lqr."submittedAt" ASC LIMIT 1
  ) fr ON true
  GROUP BY lq.id
),
late_rate AS (
  SELECT
    "liveQuizId",
    CASE WHEN COUNT(*) = 0 THEN NULL
         ELSE SUM(CASE WHEN live_quiz_finished_at IS NOT NULL
                         AND first_submitted_at > live_quiz_finished_at
                       THEN 1 ELSE 0 END)::float / COUNT(*)
    END::real AS late_submitter_rate
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
  fc.mean_first_correctness,
  r.mean_last_correctness,
  lr.late_submitter_rate,
  NOW(), NOW()
FROM rollup r
LEFT JOIN first_correct fc USING ("liveQuizId")
LEFT JOIN late_rate lr     USING ("liveQuizId")
ON CONFLICT ("liveQuizId") DO UPDATE SET
  "courseId"             = EXCLUDED."courseId",
  "participantCount"     = EXCLUDED."participantCount",
  "responseCount"        = EXCLUDED."responseCount",
  "meanFirstCorrectness" = EXCLUDED."meanFirstCorrectness",
  "meanLastCorrectness"  = EXCLUDED."meanLastCorrectness",
  "lateSubmitterRate"    = EXCLUDED."lateSubmitterRate",
  "updatedAt"            = NOW();
