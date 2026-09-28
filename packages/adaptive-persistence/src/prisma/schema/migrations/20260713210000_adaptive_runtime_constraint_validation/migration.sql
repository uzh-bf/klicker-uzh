-- Repair deterministic Phase 3 runtime-state gaps and validate every adaptive
-- runtime check that was introduced as NOT VALID. Numeric or trajectory
-- corruption is not guessed: the migration aborts with the first offending ID.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15min';

DO $$
DECLARE
  invalid_attempt_id UUID;
  invalid_response_id INTEGER;
  invalid_estimate_id INTEGER;
BEGIN
  SELECT attempt."id"
  INTO invalid_attempt_id
  FROM "AdaptivePracticeQuizAttempt" AS attempt
  WHERE NOT (
    attempt."currentTheta" BETWEEN -10 AND 10
    AND (
      attempt."currentStandardError" IS NULL
      OR attempt."currentStandardError" > 0
    )
    AND (
      attempt."finalTheta" IS NULL
      OR attempt."finalTheta" BETWEEN -10 AND 10
    )
    AND (
      attempt."finalStandardError" IS NULL
      OR attempt."finalStandardError" > 0
    )
    AND (
      attempt."elapsedSeconds" IS NULL
      OR attempt."elapsedSeconds" >= 0
    )
  )
  ORDER BY attempt."id"
  LIMIT 1;

  IF invalid_attempt_id IS NOT NULL THEN
    RAISE EXCEPTION 'Adaptive attempt % has invalid psychometric or elapsed-time values. Correct it before retrying migration 20260713210000.', invalid_attempt_id;
  END IF;

  SELECT result."id"
  INTO invalid_response_id
  FROM "AdaptivePracticeQuizResponse" AS result
  WHERE NOT (
    result."order" > 0
    AND result."score" BETWEEN 0 AND 1
    AND result."correct" = (result."score" = 1)
    AND (
      result."overallThetaBefore" IS NULL
      OR result."overallThetaBefore" BETWEEN -10 AND 10
    )
    AND (
      result."overallThetaAfter" IS NULL
      OR result."overallThetaAfter" BETWEEN -10 AND 10
    )
    AND (
      result."overallStandardErrorAfter" IS NULL
      OR result."overallStandardErrorAfter" > 0
    )
    AND (
      result."elapsedSeconds" IS NULL
      OR result."elapsedSeconds" >= 0
    )
  )
  ORDER BY result."id"
  LIMIT 1;

  IF invalid_response_id IS NOT NULL THEN
    RAISE EXCEPTION 'Adaptive response % has invalid score, psychometric, or elapsed-time values. Correct it before retrying migration 20260713210000.', invalid_response_id;
  END IF;

  SELECT estimate."id"
  INTO invalid_estimate_id
  FROM "AdaptivePracticeQuizEstimate" AS estimate
  WHERE NOT (
    (
      estimate."theta" IS NULL
      OR estimate."theta" BETWEEN -10 AND 10
    )
    AND (
      estimate."standardError" IS NULL
      OR estimate."standardError" > 0
    )
    AND estimate."responseCount" >= 0
    AND (
      (
        estimate."nodeKind" = 'OVERALL'
        AND (
          (
            estimate."theta" IS NULL
            AND estimate."standardError" IS NULL
          )
          OR (
            estimate."theta" IS NOT NULL
            AND estimate."standardError" IS NOT NULL
          )
        )
      )
      OR (
        estimate."nodeKind" <> 'OVERALL'
        AND (
          (
            estimate."responseCount" = 0
            AND estimate."theta" IS NULL
            AND estimate."standardError" IS NULL
          )
          OR (
            estimate."responseCount" > 0
            AND estimate."theta" IS NOT NULL
            AND estimate."standardError" IS NOT NULL
          )
        )
      )
    )
  )
  ORDER BY estimate."id"
  LIMIT 1;

  IF invalid_estimate_id IS NOT NULL THEN
    RAISE EXCEPTION 'Adaptive estimate % has invalid psychometric state. Correct it before retrying migration 20260713210000.', invalid_estimate_id;
  END IF;

  WITH ordered_responses AS (
    SELECT
      result."id",
      result."order",
      ROW_NUMBER() OVER (
        PARTITION BY result."attemptId"
        ORDER BY result."order", result."id"
      ) AS expected_order
    FROM "AdaptivePracticeQuizResponse" AS result
  )
  SELECT ordered."id"
  INTO invalid_response_id
  FROM ordered_responses AS ordered
  WHERE ordered."order" <> ordered.expected_order
  ORDER BY ordered."id"
  LIMIT 1;

  IF invalid_response_id IS NOT NULL THEN
    RAISE EXCEPTION 'Adaptive response % is part of a non-contiguous attempt trajectory. Repair the response order before retrying migration 20260713210000.', invalid_response_id;
  END IF;

  SELECT result."id"
  INTO invalid_response_id
  FROM "AdaptivePracticeQuizResponse" AS result
  WHERE result."poolItemId" IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM "PracticeQuizAdaptivePoolItem" AS pool
      WHERE pool."configId" = result."configId"
        AND pool."sourceAssignmentId" = result."assignmentId"
        AND pool."elementId" = result."elementId"
    )
  ORDER BY result."id"
  LIMIT 1;

  IF invalid_response_id IS NOT NULL THEN
    RAISE EXCEPTION 'Adaptive response % cannot be linked unambiguously to its immutable publication-pool item. Restore the pool row or archive the experimental response before retrying migration 20260713210000.', invalid_response_id;
  END IF;
END $$;

UPDATE "AdaptivePracticeQuizResponse" AS result
SET
  "poolItemId" = pool."id",
  "elementSnapshot" = COALESCE(result."elementSnapshot", pool."elementData")
FROM "PracticeQuizAdaptivePoolItem" AS pool
WHERE result."poolItemId" IS NULL
  AND pool."configId" = result."configId"
  AND pool."sourceAssignmentId" = result."assignmentId"
  AND pool."elementId" = result."elementId";

UPDATE "AdaptivePracticeQuizResponse" AS result
SET "elementSnapshot" = pool."elementData"
FROM "PracticeQuizAdaptivePoolItem" AS pool
WHERE result."elementSnapshot" IS NULL
  AND pool."id" = result."poolItemId"
  AND pool."configId" = result."configId"
  AND pool."sourceAssignmentId" = result."assignmentId"
  AND pool."elementId" = result."elementId";

-- An in-progress row without a next immutable item cannot be resumed safely.
-- Preserve it as an abandoned result rather than inventing a new trajectory.
UPDATE "AdaptivePracticeQuizAttempt"
SET
  "status" = 'ABANDONED',
  "stopReason" = 'ABANDONED',
  "nextPoolItemId" = NULL,
  "completedAt" = COALESCE(
    "completedAt",
    "updatedAt",
    "startedAt",
    "createdAt",
    CURRENT_TIMESTAMP
  )
WHERE "status" = 'IN_PROGRESS'
  AND "nextPoolItemId" IS NULL;

UPDATE "AdaptivePracticeQuizAttempt"
SET
  "stopReason" = NULL,
  "completedAt" = NULL
WHERE "status" = 'IN_PROGRESS'
  AND "nextPoolItemId" IS NOT NULL
  AND (
    "stopReason" IS NOT NULL
    OR "completedAt" IS NOT NULL
  );

UPDATE "AdaptivePracticeQuizAttempt"
SET
  "nextPoolItemId" = NULL,
  "stopReason" = CASE
    WHEN "stopReason" IS NULL OR "stopReason" = 'ABANDONED' THEN
      CASE
        WHEN "finalLevelId" IS NOT NULL THEN 'CLASSIFIED'::"AdaptivePracticeQuizStopReason"
        ELSE 'INSUFFICIENT_DATA'::"AdaptivePracticeQuizStopReason"
      END
    ELSE "stopReason"
  END,
  "completedAt" = COALESCE(
    "completedAt",
    "updatedAt",
    "startedAt",
    "createdAt",
    CURRENT_TIMESTAMP
  )
WHERE "status" = 'COMPLETED';

UPDATE "AdaptivePracticeQuizAttempt"
SET
  "nextPoolItemId" = NULL,
  "stopReason" = 'ABANDONED',
  "completedAt" = COALESCE(
    "completedAt",
    "updatedAt",
    "startedAt",
    "createdAt",
    CURRENT_TIMESTAMP
  )
WHERE "status" = 'ABANDONED';

ALTER TABLE "AdaptivePracticeQuizResponse"
VALIDATE CONSTRAINT "apqr_pool_item_required_check";

ALTER TABLE "AdaptivePracticeQuizResponse"
VALIDATE CONSTRAINT "apqr_element_snapshot_required_check";

ALTER TABLE "AdaptivePracticeQuizResponse"
VALIDATE CONSTRAINT "apqr_runtime_values_check";

ALTER TABLE "AdaptivePracticeQuizAttempt"
VALIDATE CONSTRAINT "apqa_runtime_state_check";

ALTER TABLE "AdaptivePracticeQuizAttempt"
VALIDATE CONSTRAINT "apqa_runtime_values_check";

ALTER TABLE "AdaptivePracticeQuizEstimate"
VALIDATE CONSTRAINT "apqe_runtime_values_check";

COMMIT;
