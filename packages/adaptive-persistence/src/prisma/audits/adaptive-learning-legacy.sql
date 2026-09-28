BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;

SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '2s';

WITH constants AS (
  SELECT 'f0186f1d-3ec8-48a4-bd58-5f968db52f48'::uuid AS seed_assessment_id
),
counts AS (
  SELECT 'AdaptiveAssessment' AS metric, count(*)::bigint AS value
  FROM "AdaptiveAssessment"
  UNION ALL
  SELECT 'AdaptiveAssessmentLevel', count(*) FROM "AdaptiveAssessmentLevel"
  UNION ALL
  SELECT 'AdaptiveAssessmentCompetence', count(*)
  FROM "AdaptiveAssessmentCompetence"
  UNION ALL
  SELECT 'AdaptiveAssessmentSubCompetence', count(*)
  FROM "AdaptiveAssessmentSubCompetence"
  UNION ALL
  SELECT 'AdaptiveAssessmentElement', count(*)
  FROM "AdaptiveAssessmentElement"
  UNION ALL
  SELECT 'AdaptiveAssessmentAttempt', count(*)
  FROM "AdaptiveAssessmentAttempt"
  UNION ALL
  SELECT 'AdaptiveAssessmentResponse', count(*)
  FROM "AdaptiveAssessmentResponse"
  UNION ALL
  SELECT 'AdaptiveAssessmentResultMessage', count(*)
  FROM "AdaptiveAssessmentResultMessage"
),
classification AS (
  SELECT
    count(*) FILTER (WHERE assessment.id = constants.seed_assessment_id)::bigint
      AS seed_assessments,
    count(*) FILTER (WHERE assessment.id <> constants.seed_assessment_id)::bigint
      AS non_seed_assessments
  FROM "AdaptiveAssessment" assessment
  CROSS JOIN constants
),
attempts AS (
  SELECT
    count(*) FILTER (WHERE attempt.status = 'IN_PROGRESS')::bigint AS in_progress,
    count(*) FILTER (WHERE attempt.status = 'COMPLETED')::bigint AS completed,
    count(*) FILTER (WHERE attempt.status = 'ABANDONED')::bigint AS abandoned,
    count(DISTINCT attempt."participantId")::bigint AS distinct_participants,
    count(*) FILTER (
      WHERE attempt."assessmentId" <> constants.seed_assessment_id
    )::bigint AS non_seed_attempts
  FROM "AdaptiveAssessmentAttempt" attempt
  CROSS JOIN constants
),
responses AS (
  SELECT
    count(*) FILTER (
      WHERE attempt."assessmentId" <> constants.seed_assessment_id
    )::bigint AS non_seed_responses,
    count(*) FILTER (
      WHERE attempt."assessmentId" <> element."assessmentId"
    )::bigint AS cross_assessment_responses
  FROM "AdaptiveAssessmentResponse" response
  JOIN "AdaptiveAssessmentAttempt" attempt
    ON attempt.id = response."attemptId"
  JOIN "AdaptiveAssessmentElement" element
    ON element.id = response."adaptiveElementId"
  CROSS JOIN constants
),
decision AS (
  SELECT CASE
    WHEN (SELECT coalesce(sum(value), 0) FROM counts) = 0
      THEN 'CLEANUP_CANDIDATE'
    WHEN classification.non_seed_assessments = 0
      AND attempts.non_seed_attempts = 0
      AND responses.non_seed_responses = 0
      THEN 'SEED_ONLY_MANUAL_REVIEW'
    ELSE 'MIGRATION_DECISION_REQUIRED'
  END AS value
  FROM classification, attempts, responses
),
report AS (
  SELECT 10 AS ordering, metric, value::text FROM counts
  UNION ALL
  SELECT 20, 'seed_assessments', seed_assessments::text FROM classification
  UNION ALL
  SELECT 21, 'non_seed_assessments', non_seed_assessments::text FROM classification
  UNION ALL
  SELECT 30, 'attempts_in_progress', in_progress::text FROM attempts
  UNION ALL
  SELECT 31, 'attempts_completed', completed::text FROM attempts
  UNION ALL
  SELECT 32, 'attempts_abandoned', abandoned::text FROM attempts
  UNION ALL
  SELECT 33, 'distinct_participants', distinct_participants::text FROM attempts
  UNION ALL
  SELECT 34, 'non_seed_attempts', non_seed_attempts::text FROM attempts
  UNION ALL
  SELECT 40, 'non_seed_responses', non_seed_responses::text FROM responses
  UNION ALL
  SELECT 41, 'cross_assessment_responses', cross_assessment_responses::text
  FROM responses
  UNION ALL
  SELECT 99, 'decision', value FROM decision
)
SELECT metric, value
FROM report
ORDER BY ordering, metric;

ROLLBACK;
