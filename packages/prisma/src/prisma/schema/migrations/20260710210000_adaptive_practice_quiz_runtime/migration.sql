-- Phase 3 makes ordered response rows the canonical trajectory and removes the
-- transitional live-tree pointer that predates immutable publication pools.
CREATE TYPE "AdaptivePracticeQuizStopReason" AS ENUM (
  'CLASSIFIED',
  'ALL_ROOTS_CLASSIFIED',
  'TOTAL_QUESTION_CAP',
  'NODE_QUESTION_CAP',
  'POOL_EXHAUSTED',
  'INSUFFICIENT_DATA',
  'ABANDONED'
);

DO $$
DECLARE
  invalid_attempt_id UUID;
  invalid_estimate_id INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "AdaptivePracticeQuizAttempt"
    WHERE "nextAssignmentId" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Adaptive attempts still reference live competence-tree assignments; migrate or abandon those experimental attempts before applying the Phase 3 runtime migration.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "AdaptivePracticeQuizEstimate"
    WHERE "stopReason" IS NOT NULL
      AND "stopReason" NOT IN (
        'CLASSIFIED',
        'ALL_ROOTS_CLASSIFIED',
        'TOTAL_QUESTION_CAP',
        'NODE_QUESTION_CAP',
        'POOL_EXHAUSTED',
        'INSUFFICIENT_DATA',
        'ABANDONED'
      )
  ) THEN
    RAISE EXCEPTION 'Adaptive estimates contain unknown stop reasons; review those experimental rows before applying the Phase 3 runtime migration.';
  END IF;

  SELECT attempt."id"
  INTO invalid_attempt_id
  FROM "AdaptivePracticeQuizAttempt" AS attempt
  JOIN "PracticeQuizAdaptiveConfig" AS config
    ON config."id" = attempt."configId"
  JOIN "CompetenceTreeLevel" AS level
    ON level."id" = attempt."finalLevelId"
  WHERE level."treeId" <> config."competenceTreeId"
  ORDER BY attempt."id"
  LIMIT 1;

  IF invalid_attempt_id IS NOT NULL THEN
    RAISE EXCEPTION 'Adaptive attempt % has a final level from another competence tree; clear or migrate that experimental result before applying the Phase 3 runtime migration.', invalid_attempt_id;
  END IF;

  SELECT estimate."id"
  INTO invalid_estimate_id
  FROM "AdaptivePracticeQuizEstimate" AS estimate
  JOIN "AdaptivePracticeQuizAttempt" AS attempt
    ON attempt."id" = estimate."attemptId"
  JOIN "PracticeQuizAdaptiveConfig" AS config
    ON config."id" = attempt."configId"
  JOIN "CompetenceTreeNode" AS node
    ON node."id" = estimate."nodeId"
  WHERE node."treeId" <> config."competenceTreeId"
  ORDER BY estimate."id"
  LIMIT 1;

  IF invalid_estimate_id IS NOT NULL THEN
    RAISE EXCEPTION 'Adaptive estimate % references a node from another competence tree; clear or migrate that experimental result before applying the Phase 3 runtime migration.', invalid_estimate_id;
  END IF;

  SELECT estimate."id"
  INTO invalid_estimate_id
  FROM "AdaptivePracticeQuizEstimate" AS estimate
  JOIN "AdaptivePracticeQuizAttempt" AS attempt
    ON attempt."id" = estimate."attemptId"
  JOIN "PracticeQuizAdaptiveConfig" AS config
    ON config."id" = attempt."configId"
  JOIN "CompetenceTreeLevel" AS level
    ON level."id" = estimate."levelId"
  WHERE level."treeId" <> config."competenceTreeId"
  ORDER BY estimate."id"
  LIMIT 1;

  IF invalid_estimate_id IS NOT NULL THEN
    RAISE EXCEPTION 'Adaptive estimate % references a level from another competence tree; clear or migrate that experimental result before applying the Phase 3 runtime migration.', invalid_estimate_id;
  END IF;
END $$;

ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD COLUMN "stopReason" "AdaptivePracticeQuizStopReason",
ADD COLUMN "competenceTreeId" UUID;

UPDATE "AdaptivePracticeQuizAttempt" AS attempt
SET "competenceTreeId" = config."competenceTreeId"
FROM "PracticeQuizAdaptiveConfig" AS config
WHERE attempt."configId" = config."id";

-- Preserve the terminal reason for pre-runtime attempts. Prefer the canonical
-- overall estimate and use deterministic fallbacks for older experimental rows.
UPDATE "AdaptivePracticeQuizAttempt" AS attempt
SET "stopReason" = CASE
  WHEN attempt."status" = 'ABANDONED' THEN
    'ABANDONED'::"AdaptivePracticeQuizStopReason"
  WHEN attempt."status" = 'COMPLETED' THEN
    COALESCE(
      (
        SELECT estimate."stopReason"::"AdaptivePracticeQuizStopReason"
        FROM "AdaptivePracticeQuizEstimate" AS estimate
        WHERE estimate."attemptId" = attempt."id"
          AND estimate."nodeKind" = 'OVERALL'
          AND estimate."nodeId" IS NULL
        ORDER BY estimate."id" DESC
        LIMIT 1
      ),
      CASE
        WHEN attempt."finalLevelId" IS NOT NULL THEN
          'CLASSIFIED'::"AdaptivePracticeQuizStopReason"
        ELSE
          'INSUFFICIENT_DATA'::"AdaptivePracticeQuizStopReason"
      END
    )
  ELSE NULL
END
WHERE attempt."status" <> 'IN_PROGRESS';

ALTER TABLE "AdaptivePracticeQuizAttempt"
ALTER COLUMN "competenceTreeId" SET NOT NULL;

ALTER TABLE "AdaptivePracticeQuizEstimate"
ADD COLUMN "configId" UUID,
ADD COLUMN "competenceTreeId" UUID;

UPDATE "AdaptivePracticeQuizEstimate" AS estimate
SET
  "configId" = attempt."configId",
  "competenceTreeId" = attempt."competenceTreeId"
FROM "AdaptivePracticeQuizAttempt" AS attempt
WHERE estimate."attemptId" = attempt."id";

ALTER TABLE "AdaptivePracticeQuizEstimate"
ALTER COLUMN "configId" SET NOT NULL,
ALTER COLUMN "competenceTreeId" SET NOT NULL,
ALTER COLUMN "theta" DROP NOT NULL;

ALTER TABLE "AdaptivePracticeQuizEstimate"
ALTER COLUMN "stopReason" TYPE "AdaptivePracticeQuizStopReason"
USING "stopReason"::"AdaptivePracticeQuizStopReason";

ALTER TABLE "AdaptivePracticeQuizResponse"
RENAME COLUMN "thetaBefore" TO "overallThetaBefore";

ALTER TABLE "AdaptivePracticeQuizResponse"
RENAME COLUMN "thetaAfter" TO "overallThetaAfter";

ALTER TABLE "AdaptivePracticeQuizResponse"
RENAME COLUMN "standardErrorAfter" TO "overallStandardErrorAfter";

ALTER TABLE "AdaptivePracticeQuizResponse"
ALTER COLUMN "overallThetaBefore" DROP NOT NULL,
ALTER COLUMN "overallThetaAfter" DROP NOT NULL,
ALTER COLUMN "overallStandardErrorAfter" DROP NOT NULL,
ADD COLUMN "score" DOUBLE PRECISION;

-- Existing experimental rows retain their original binary outcome as score
-- and response JSON as the normalized audit value. New runtime rows always
-- write the type-specific canonical normalization explicitly.
UPDATE "AdaptivePracticeQuizResponse"
SET
  "normalizedResponse" = COALESCE("normalizedResponse", "response"),
  "score" = CASE WHEN "correct" THEN 1.0 ELSE 0.0 END;

UPDATE "AdaptivePracticeQuizResponse" AS response
SET "elementSnapshot" = pool."elementData"
FROM "PracticeQuizAdaptivePoolItem" AS pool
WHERE response."elementSnapshot" IS NULL
  AND response."poolItemId" = pool."id"
  AND response."configId" = pool."configId";

ALTER TABLE "AdaptivePracticeQuizResponse"
ALTER COLUMN "normalizedResponse" SET NOT NULL,
ALTER COLUMN "score" SET NOT NULL;

ALTER TABLE "AdaptivePracticeQuizAttempt"
DROP CONSTRAINT "AdaptivePracticeQuizAttempt_nextAssignmentId_fkey";

DROP INDEX "apqa_next_assignment_idx";

ALTER TABLE "AdaptivePracticeQuizAttempt"
DROP COLUMN "nextAssignmentId",
DROP COLUMN "thetaHistory",
DROP COLUMN "standardErrorHistory";

CREATE UNIQUE INDEX "pqac_id_quiz_tree_key"
ON "PracticeQuizAdaptiveConfig" ("id", "practiceQuizId", "competenceTreeId");

CREATE UNIQUE INDEX "apqa_id_config_tree_key"
ON "AdaptivePracticeQuizAttempt" ("id", "configId", "competenceTreeId");

CREATE INDEX "apqe_config_tree_idx"
ON "AdaptivePracticeQuizEstimate" ("configId", "competenceTreeId");

ALTER TABLE "AdaptivePracticeQuizAttempt"
DROP CONSTRAINT "AdaptivePracticeQuizAttempt_configId_practiceQuizId_fkey";

ALTER TABLE "AdaptivePracticeQuizAttempt"
DROP CONSTRAINT "AdaptivePracticeQuizAttempt_finalLevelId_fkey";

ALTER TABLE "AdaptivePracticeQuizEstimate"
DROP CONSTRAINT "AdaptivePracticeQuizEstimate_attemptId_fkey";

ALTER TABLE "AdaptivePracticeQuizEstimate"
DROP CONSTRAINT "AdaptivePracticeQuizEstimate_nodeId_fkey";

ALTER TABLE "AdaptivePracticeQuizEstimate"
DROP CONSTRAINT "AdaptivePracticeQuizEstimate_levelId_fkey";

ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD CONSTRAINT "AdaptivePracticeQuizAttempt_config_quiz_tree_fkey"
FOREIGN KEY ("configId", "practiceQuizId", "competenceTreeId")
REFERENCES "PracticeQuizAdaptiveConfig" ("id", "practiceQuizId", "competenceTreeId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD CONSTRAINT "AdaptivePracticeQuizAttempt_final_level_same_tree_fkey"
FOREIGN KEY ("competenceTreeId", "finalLevelId")
REFERENCES "CompetenceTreeLevel" ("treeId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "AdaptivePracticeQuizEstimate"
ADD CONSTRAINT "AdaptivePracticeQuizEstimate_attempt_config_tree_fkey"
FOREIGN KEY ("attemptId", "configId", "competenceTreeId")
REFERENCES "AdaptivePracticeQuizAttempt" ("id", "configId", "competenceTreeId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdaptivePracticeQuizEstimate"
ADD CONSTRAINT "AdaptivePracticeQuizEstimate_node_same_tree_fkey"
FOREIGN KEY ("competenceTreeId", "nodeId")
REFERENCES "CompetenceTreeNode" ("treeId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "AdaptivePracticeQuizEstimate"
ADD CONSTRAINT "AdaptivePracticeQuizEstimate_level_same_tree_fkey"
FOREIGN KEY ("competenceTreeId", "levelId")
REFERENCES "CompetenceTreeLevel" ("treeId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

-- NOT VALID preserves readable experimental history while enforcing the full
-- Phase 3 contract for every new or updated row.
ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD CONSTRAINT "apqa_runtime_state_check"
CHECK (
  (
    "status" = 'IN_PROGRESS'
    AND "nextPoolItemId" IS NOT NULL
    AND "stopReason" IS NULL
    AND "completedAt" IS NULL
  )
  OR (
    "status" = 'COMPLETED'
    AND "nextPoolItemId" IS NULL
    AND "stopReason" IS NOT NULL
    AND "stopReason" <> 'ABANDONED'
    AND "completedAt" IS NOT NULL
  )
  OR (
    "status" = 'ABANDONED'
    AND "nextPoolItemId" IS NULL
    AND "stopReason" = 'ABANDONED'
    AND "completedAt" IS NOT NULL
  )
) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD CONSTRAINT "apqa_runtime_values_check"
CHECK (
  "currentTheta" BETWEEN -10 AND 10
  AND ("currentStandardError" IS NULL OR "currentStandardError" > 0)
  AND ("finalTheta" IS NULL OR "finalTheta" BETWEEN -10 AND 10)
  AND ("finalStandardError" IS NULL OR "finalStandardError" > 0)
  AND ("elapsedSeconds" IS NULL OR "elapsedSeconds" >= 0)
) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizResponse"
ADD CONSTRAINT "apqr_runtime_values_check"
CHECK (
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
) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizResponse"
ADD CONSTRAINT "apqr_element_snapshot_required_check"
CHECK ("elementSnapshot" IS NOT NULL) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizEstimate"
ADD CONSTRAINT "apqe_runtime_values_check"
CHECK (
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
) NOT VALID;
