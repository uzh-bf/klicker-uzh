\set ON_ERROR_STOP on
\pset pager off

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '2min';

-- Aggregate-only preflight for the forward runtime-repair and retention
-- migrations. Zero invalid_* counts are required. repairable_* counts are
-- expected to be changed deterministically by migration 20260713210000.
SELECT
  COUNT(*) AS total_attempts,
  COUNT(*) FILTER (
    WHERE "status" = 'IN_PROGRESS'
      AND "nextPoolItemId" IS NULL
  ) AS repairable_unresumable_attempts,
  COUNT(*) FILTER (
    WHERE (
      "status" = 'IN_PROGRESS'
      AND "nextPoolItemId" IS NOT NULL
      AND ("stopReason" IS NOT NULL OR "completedAt" IS NOT NULL)
    ) OR (
      "status" IN ('COMPLETED', 'ABANDONED')
      AND (
        "nextPoolItemId" IS NOT NULL
        OR "completedAt" IS NULL
        OR "stopReason" IS NULL
      )
    )
  ) AS repairable_lifecycle_rows,
  COUNT(*) FILTER (
    WHERE NOT (
      "currentTheta" BETWEEN -10 AND 10
      AND ("currentStandardError" IS NULL OR "currentStandardError" > 0)
      AND ("finalTheta" IS NULL OR "finalTheta" BETWEEN -10 AND 10)
      AND ("finalStandardError" IS NULL OR "finalStandardError" > 0)
      AND ("elapsedSeconds" IS NULL OR "elapsedSeconds" >= 0)
    )
  ) AS invalid_attempt_runtime_values
FROM "AdaptivePracticeQuizAttempt";

WITH response_health AS (
  SELECT
    result.*,
    ROW_NUMBER() OVER (
      PARTITION BY result."attemptId"
      ORDER BY result."order", result."id"
    ) AS expected_order,
    EXISTS (
      SELECT 1
      FROM "PracticeQuizAdaptivePoolItem" AS pool
      WHERE pool."configId" = result."configId"
        AND pool."sourceAssignmentId" = result."assignmentId"
        AND pool."elementId" = result."elementId"
    ) AS has_matching_pool_item
  FROM "AdaptivePracticeQuizResponse" AS result
)
SELECT
  COUNT(*) AS total_responses,
  COUNT(*) FILTER (
    WHERE "poolItemId" IS NULL AND has_matching_pool_item
  ) AS repairable_missing_pool_items,
  COUNT(*) FILTER (
    WHERE "elementSnapshot" IS NULL
      AND ("poolItemId" IS NOT NULL OR has_matching_pool_item)
  ) AS repairable_missing_snapshots,
  COUNT(*) FILTER (
    WHERE "poolItemId" IS NULL AND NOT has_matching_pool_item
  ) AS invalid_unresolvable_pool_items,
  COUNT(*) FILTER (
    WHERE "order" <> expected_order
  ) AS invalid_noncontiguous_response_orders,
  COUNT(*) FILTER (
    WHERE NOT (
      "order" > 0
      AND "score" BETWEEN 0 AND 1
      AND "correct" = ("score" = 1)
      AND ("overallThetaBefore" IS NULL OR "overallThetaBefore" BETWEEN -10 AND 10)
      AND ("overallThetaAfter" IS NULL OR "overallThetaAfter" BETWEEN -10 AND 10)
      AND (
        "overallStandardErrorAfter" IS NULL
        OR "overallStandardErrorAfter" > 0
      )
      AND ("elapsedSeconds" IS NULL OR "elapsedSeconds" >= 0)
    )
  ) AS invalid_response_runtime_values
FROM response_health;

SELECT
  COUNT(*) AS total_estimates,
  COUNT(*) FILTER (
    WHERE NOT (
      ("theta" IS NULL OR "theta" BETWEEN -10 AND 10)
      AND ("standardError" IS NULL OR "standardError" > 0)
      AND "responseCount" >= 0
      AND (
        (
          "nodeKind" = 'OVERALL'
          AND (
            ("theta" IS NULL AND "standardError" IS NULL)
            OR ("theta" IS NOT NULL AND "standardError" IS NOT NULL)
          )
        )
        OR (
          "nodeKind" <> 'OVERALL'
          AND (
            (
              "responseCount" = 0
              AND "theta" IS NULL
              AND "standardError" IS NULL
            )
            OR (
              "responseCount" > 0
              AND "theta" IS NOT NULL
              AND "standardError" IS NOT NULL
            )
          )
        )
      )
    )
  ) AS invalid_estimate_runtime_values
FROM "AdaptivePracticeQuizEstimate";

SELECT
  conname AS constraint_name,
  convalidated AS is_validated
FROM pg_constraint
WHERE conname IN (
  'apqa_runtime_state_check',
  'apqa_runtime_values_check',
  'apqe_runtime_values_check',
  'apqr_element_snapshot_required_check',
  'apqr_pool_item_required_check',
  'apqr_runtime_values_check'
)
ORDER BY conname;

ROLLBACK;
