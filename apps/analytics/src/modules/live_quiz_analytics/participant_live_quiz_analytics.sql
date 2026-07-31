-- ParticipantLiveQuizAnalytics: one row per (participantId, liveQuizId) for every assessment-mode live quiz.
-- Path: LiveQuizResponse -> ElementInstance -> ElementBlock -> LiveQuiz. Only LiveQuiz.isAssessmentEnabled = true.
-- Per §3.12: normal-mode live quizzes aren't tracked per-participant today, so we deliberately skip them.

WITH assessment_responses AS (
  SELECT
    lqr.id,
    lqr."participantId",
    lq.id           AS "liveQuizId",
    lq."courseId",
    lqr.correctness,
    lqr."timeSpent",
    lqr."basePoints",
    lqr."correctnessPoints",
    lqr."bonusPoints",
    ROW_NUMBER() OVER (
      PARTITION BY lqr."participantId", ei.id
      ORDER BY lqr."submittedAt" ASC
    ) AS attempt_asc,
    ROW_NUMBER() OVER (
      PARTITION BY lqr."participantId", ei.id
      ORDER BY lqr."submittedAt" DESC
    ) AS attempt_desc
  FROM "LiveQuizResponse" lqr
  JOIN "ElementInstance" ei ON ei.id = lqr."instanceId"
  JOIN "ElementBlock"    eb ON eb.id = ei."elementBlockId"
  JOIN "LiveQuiz"        lq ON lq.id = eb."liveQuizId"
  WHERE lq."isAssessmentEnabled" = true
    AND lq."courseId" IS NOT NULL
    AND lqr."correctionOnly" = false
    /*COURSE_FILTER*/
)
INSERT INTO "ParticipantLiveQuizAnalytics" (
  "participantId", "liveQuizId", "courseId",
  "totalResponses",
  "firstCorrectCount", "lastCorrectCount",
  "averageTimeSpent",
  "totalBasePoints", "totalCorrectnessPoints", "totalBonusPoints",
  "createdAt", "updatedAt"
)
SELECT
  "participantId",
  "liveQuizId",
  "courseId",
  COUNT(*)                                                       AS total_responses,
  SUM(CASE WHEN attempt_asc  = 1 AND correctness = 'CORRECT' THEN 1 ELSE 0 END)::int AS first_correct_count,
  SUM(CASE WHEN attempt_desc = 1 AND correctness = 'CORRECT' THEN 1 ELSE 0 END)::int AS last_correct_count,
  AVG("timeSpent")::real                                         AS average_time_spent,
  SUM("basePoints")::int                                         AS total_base_points,
  SUM("correctnessPoints")::int                                  AS total_correctness_points,
  SUM("bonusPoints")::int                                        AS total_bonus_points,
  NOW(), NOW()
FROM assessment_responses
GROUP BY "participantId", "liveQuizId", "courseId"
ON CONFLICT ("participantId", "liveQuizId") DO UPDATE SET
  "courseId"                = EXCLUDED."courseId",
  "totalResponses"          = EXCLUDED."totalResponses",
  "firstCorrectCount"       = EXCLUDED."firstCorrectCount",
  "lastCorrectCount"        = EXCLUDED."lastCorrectCount",
  "averageTimeSpent"        = EXCLUDED."averageTimeSpent",
  "totalBasePoints"         = EXCLUDED."totalBasePoints",
  "totalCorrectnessPoints"  = EXCLUDED."totalCorrectnessPoints",
  "totalBonusPoints"        = EXCLUDED."totalBonusPoints",
  "updatedAt"               = NOW();
