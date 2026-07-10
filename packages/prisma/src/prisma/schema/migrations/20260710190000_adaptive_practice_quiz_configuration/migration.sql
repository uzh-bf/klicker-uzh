-- Persist product semantics instead of inferring them from mutable defaults.
CREATE TYPE "AdaptivePracticeQuizPreset" AS ENUM (
  'PLACEMENT',
  'DIAGNOSTIC',
  'RESEARCH'
);

CREATE TYPE "AdaptiveAttemptSelectionPolicy" AS ENUM (
  'FIRST_COMPLETED',
  'LATEST_COMPLETED'
);

ALTER TABLE "PracticeQuizAdaptiveConfig"
ADD COLUMN "preset" "AdaptivePracticeQuizPreset" NOT NULL DEFAULT 'DIAGNOSTIC',
ADD COLUMN "attemptSelectionPolicy" "AdaptiveAttemptSelectionPolicy" NOT NULL DEFAULT 'LATEST_COMPLETED',
ADD COLUMN "poolPublishedAt" TIMESTAMP(3);

-- Preserve pre-existing advanced settings by classifying those rows as
-- research configurations. Normal presets receive only their stable policy.
UPDATE "PracticeQuizAdaptiveConfig" AS config
SET
  "preset" = CASE
    WHEN
      config."showLiveEstimate" = false
      AND config."topInformationRatio" = 0.8
      AND config."defaultDiscrimination" = 1.2
      AND NOT EXISTS (
        SELECT 1
        FROM "CompetenceTree" AS tree
        WHERE tree."id" = config."competenceTreeId"
          AND tree."defaultDiscrimination" <> 1.2
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "CompetenceTreeElementAssignment" AS tree_assignment
        WHERE tree_assignment."treeId" = config."competenceTreeId"
          AND tree_assignment."discrimination" IS NOT NULL
          AND tree_assignment."discrimination" <> 1.2
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "PracticeQuizAdaptiveElementOverride" AS element_override
        WHERE element_override."configId" = config."id"
          AND element_override."discrimination" IS NOT NULL
      )
    THEN CASE
      WHEN config."levelMappingRule" = 'MASTERY'
        THEN 'PLACEMENT'::"AdaptivePracticeQuizPreset"
      ELSE 'DIAGNOSTIC'::"AdaptivePracticeQuizPreset"
    END
    ELSE 'RESEARCH'::"AdaptivePracticeQuizPreset"
  END,
  "attemptSelectionPolicy" = CASE
    WHEN config."levelMappingRule" = 'MASTERY' THEN 'FIRST_COMPLETED'::"AdaptiveAttemptSelectionPolicy"
    ELSE 'LATEST_COMPLETED'::"AdaptiveAttemptSelectionPolicy"
  END,
  "showFinalResult" = true,
  "enableSelfAssessmentWarmup" = false;

UPDATE "PracticeQuiz" AS quiz
SET "mode" = 'ADAPTIVE'
FROM "PracticeQuizAdaptiveConfig" AS config
WHERE config."practiceQuizId" = quiz."id";

UPDATE "PracticeQuiz"
SET
  "pointsMultiplier" = 0,
  "isGamificationEnabled" = false,
  "isAssessmentEnabled" = false
WHERE "mode" = 'ADAPTIVE';

-- Phase 2 deliberately supports immediate adaptive publication only. Any
-- experimental scheduled row is returned to draft; an already-created stale
-- task observes DRAFT with a null task id and exits idempotently.
UPDATE "PracticeQuiz"
SET
  "status" = 'DRAFT',
  "availableFrom" = NULL,
  "scheduledPublicationTaskId" = NULL
WHERE "mode" = 'ADAPTIVE'
  AND "status" = 'SCHEDULED';

-- Repeat tree identity on override rows so PostgreSQL can reject cross-tree ids.
ALTER TABLE "PracticeQuizAdaptiveNodeOverride"
ADD COLUMN "competenceTreeId" UUID;

ALTER TABLE "PracticeQuizAdaptiveElementOverride"
ADD COLUMN "competenceTreeId" UUID;

UPDATE "PracticeQuizAdaptiveNodeOverride" AS override
SET "competenceTreeId" = config."competenceTreeId"
FROM "PracticeQuizAdaptiveConfig" AS config
WHERE config."id" = override."configId";

UPDATE "PracticeQuizAdaptiveElementOverride" AS override
SET "competenceTreeId" = config."competenceTreeId"
FROM "PracticeQuizAdaptiveConfig" AS config
WHERE config."id" = override."configId";

ALTER TABLE "PracticeQuizAdaptiveNodeOverride"
ALTER COLUMN "competenceTreeId" SET NOT NULL;

ALTER TABLE "PracticeQuizAdaptiveElementOverride"
ALTER COLUMN "competenceTreeId" SET NOT NULL;

-- Immutable source for adaptive delivery. Runtime never reads mutable Element data.
CREATE TABLE "PracticeQuizAdaptivePoolItem" (
  "id" SERIAL NOT NULL,
  "configId" UUID NOT NULL,
  "competenceTreeId" UUID NOT NULL,
  "sourceAssignmentId" INTEGER NOT NULL,
  "elementId" INTEGER NOT NULL,
  "elementVersion" INTEGER NOT NULL,
  "elementType" "ElementType" NOT NULL,
  "elementName" TEXT NOT NULL,
  "elementData" JSONB NOT NULL,
  "leafNodeId" INTEGER NOT NULL,
  "nodePath" INTEGER[] NOT NULL,
  "nodeNamePath" TEXT[] NOT NULL,
  "levelId" INTEGER NOT NULL,
  "levelLabel" TEXT NOT NULL,
  "levelOrder" INTEGER NOT NULL,
  "discrimination" DOUBLE PRECISION NOT NULL,
  "difficulty" DOUBLE PRECISION NOT NULL,
  "guessing" DOUBLE PRECISION NOT NULL,
  "enablePercentInput" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PracticeQuizAdaptivePoolItem_pkey" PRIMARY KEY ("id")
);

-- Transitional nullable references preserve experimental rows. A NOT VALID
-- check below still requires every newly inserted response to use the pool.
ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD COLUMN "nextPoolItemId" INTEGER,
ADD COLUMN "courseId" UUID;

UPDATE "AdaptivePracticeQuizAttempt" AS attempt
SET "courseId" = quiz."courseId"
FROM "PracticeQuiz" AS quiz
WHERE quiz."id" = attempt."practiceQuizId";

ALTER TABLE "AdaptivePracticeQuizAttempt"
ALTER COLUMN "courseId" SET NOT NULL;

ALTER TABLE "AdaptivePracticeQuizResponse"
ADD COLUMN "poolItemId" INTEGER,
ADD COLUMN "configId" UUID;

UPDATE "AdaptivePracticeQuizResponse" AS response
SET "configId" = attempt."configId"
FROM "AdaptivePracticeQuizAttempt" AS attempt
WHERE attempt."id" = response."attemptId";

ALTER TABLE "AdaptivePracticeQuizResponse"
ALTER COLUMN "configId" SET NOT NULL;

CREATE UNIQUE INDEX "ctea_tree_id_key"
ON "CompetenceTreeElementAssignment" ("treeId", "id");

CREATE UNIQUE INDEX "pqac_id_tree_key"
ON "PracticeQuizAdaptiveConfig" ("id", "competenceTreeId");

CREATE UNIQUE INDEX "pqac_id_quiz_key"
ON "PracticeQuizAdaptiveConfig" ("id", "practiceQuizId");

CREATE UNIQUE INDEX "practice_quiz_id_course_key"
ON "PracticeQuiz" ("id", "courseId");

CREATE UNIQUE INDEX "participation_identity_key"
ON "Participation" ("id", "participantId", "courseId");

CREATE UNIQUE INDEX "pqapi_config_assignment_key"
ON "PracticeQuizAdaptivePoolItem" ("configId", "sourceAssignmentId");

CREATE UNIQUE INDEX "pqapi_config_id_key"
ON "PracticeQuizAdaptivePoolItem" ("configId", "id");

CREATE UNIQUE INDEX "pqapi_response_identity_key"
ON "PracticeQuizAdaptivePoolItem" ("configId", "id", "sourceAssignmentId", "elementId");

CREATE UNIQUE INDEX "apqa_id_config_key"
ON "AdaptivePracticeQuizAttempt" ("id", "configId");

CREATE INDEX "pqapi_config_leaf_level_idx"
ON "PracticeQuizAdaptivePoolItem" ("configId", "leafNodeId", "levelId");

CREATE INDEX "pqapi_element_version_idx"
ON "PracticeQuizAdaptivePoolItem" ("elementId", "elementVersion");

CREATE INDEX "pqapi_tree_assignment_idx"
ON "PracticeQuizAdaptivePoolItem" ("competenceTreeId", "sourceAssignmentId");

CREATE INDEX "pqan_tree_node_idx"
ON "PracticeQuizAdaptiveNodeOverride" ("competenceTreeId", "nodeId");

CREATE INDEX "pqae_tree_assignment_idx"
ON "PracticeQuizAdaptiveElementOverride" ("competenceTreeId", "assignmentId");

CREATE INDEX "apqa_next_pool_item_idx"
ON "AdaptivePracticeQuizAttempt" ("nextPoolItemId");

CREATE INDEX "apqa_config_quiz_idx"
ON "AdaptivePracticeQuizAttempt" ("configId", "practiceQuizId");

CREATE INDEX "apqa_participation_identity_idx"
ON "AdaptivePracticeQuizAttempt" ("participationId", "participantId", "courseId");

CREATE INDEX "apqa_config_next_pool_idx"
ON "AdaptivePracticeQuizAttempt" ("configId", "nextPoolItemId");

CREATE INDEX "apqr_pool_item_idx"
ON "AdaptivePracticeQuizResponse" ("poolItemId");

CREATE INDEX "apqr_config_pool_idx"
ON "AdaptivePracticeQuizResponse" ("configId", "poolItemId");

-- Stop with an actionable error instead of silently rewriting invalid
-- experimental values that cannot satisfy the production contract.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "PracticeQuizAdaptiveConfig"
    WHERE NOT (
      "totalQuestionCap" BETWEEN 1 AND 1000
      AND ("perLeafQuestionCap" IS NULL OR "perLeafQuestionCap" BETWEEN 1 AND "totalQuestionCap")
      AND "minQuestionsPerLeaf" BETWEEN 1 AND "totalQuestionCap"
      AND "classificationZ" > 0 AND "classificationZ" <= 5
      AND ("standardErrorThreshold" IS NULL OR "standardErrorThreshold" > 0)
      AND "topInformationRatio" > 0 AND "topInformationRatio" <= 1
      AND "defaultDiscrimination" > 0 AND "defaultDiscrimination" <= 10
    )
  ) THEN
    RAISE EXCEPTION 'Adaptive configuration contains values outside the Phase 2 production bounds; review the affected row before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "PracticeQuizAdaptiveNodeOverride"
    WHERE ("weight" IS NOT NULL AND "weight" < 0)
      OR ("questionCap" IS NOT NULL AND "questionCap" NOT BETWEEN 1 AND 1000)
  ) THEN
    RAISE EXCEPTION 'Adaptive node override contains values outside the Phase 2 production bounds; review the affected row before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "PracticeQuizAdaptiveElementOverride"
    WHERE "discrimination" IS NOT NULL
      AND NOT ("discrimination" > 0 AND "discrimination" <= 10)
  ) THEN
    RAISE EXCEPTION 'Adaptive element override contains values outside the Phase 2 production bounds; review the affected row before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "AdaptivePracticeQuizAttempt" AS attempt
    JOIN "PracticeQuizAdaptiveConfig" AS config
      ON config."id" = attempt."configId"
    WHERE attempt."practiceQuizId" <> config."practiceQuizId"
  ) THEN
    RAISE EXCEPTION 'Adaptive attempt references a config owned by another practice quiz; repair the affected row before migrating.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "AdaptivePracticeQuizAttempt" AS attempt
    JOIN "Participation" AS participation
      ON participation."id" = attempt."participationId"
    WHERE participation."participantId" <> attempt."participantId"
      OR participation."courseId" <> attempt."courseId"
  ) THEN
    RAISE EXCEPTION 'Adaptive attempt participant/course does not match its participation; repair the affected row before migrating.';
  END IF;
END $$;

-- Product and numerical invariants remain valid even for direct database writes.
ALTER TABLE "PracticeQuizAdaptiveConfig"
ADD CONSTRAINT "pqac_numeric_bounds_check"
CHECK (
  "totalQuestionCap" BETWEEN 1 AND 1000
  AND ("perLeafQuestionCap" IS NULL OR "perLeafQuestionCap" BETWEEN 1 AND "totalQuestionCap")
  AND "minQuestionsPerLeaf" BETWEEN 1 AND "totalQuestionCap"
  AND "classificationZ" > 0 AND "classificationZ" <= 5
  AND ("standardErrorThreshold" IS NULL OR "standardErrorThreshold" > 0)
  AND "topInformationRatio" > 0 AND "topInformationRatio" <= 1
  AND "defaultDiscrimination" > 0 AND "defaultDiscrimination" <= 10
);

ALTER TABLE "PracticeQuizAdaptiveConfig"
ADD CONSTRAINT "pqac_preset_semantics_check"
CHECK (
  (
    "preset" = 'PLACEMENT'
    AND "levelMappingRule" = 'MASTERY'
    AND "attemptSelectionPolicy" = 'FIRST_COMPLETED'
    AND "showLiveEstimate" = false
    AND "topInformationRatio" = 0.8
    AND "defaultDiscrimination" = 1.2
  )
  OR (
    "preset" = 'DIAGNOSTIC'
    AND "levelMappingRule" = 'NEAREST'
    AND "attemptSelectionPolicy" = 'LATEST_COMPLETED'
    AND "showLiveEstimate" = false
    AND "topInformationRatio" = 0.8
    AND "defaultDiscrimination" = 1.2
  )
  OR "preset" = 'RESEARCH'
);

ALTER TABLE "PracticeQuizAdaptiveConfig"
ADD CONSTRAINT "pqac_final_result_required_check"
CHECK ("showFinalResult" = true);

ALTER TABLE "PracticeQuiz"
ADD CONSTRAINT "practice_quiz_adaptive_no_gamification_check"
CHECK (
  "mode" <> 'ADAPTIVE'
  OR (
    "pointsMultiplier" = 0
    AND "isGamificationEnabled" = false
    AND "isAssessmentEnabled" = false
  )
);

ALTER TABLE "PracticeQuizAdaptiveNodeOverride"
ADD CONSTRAINT "pqan_values_check"
CHECK (
  ("weight" IS NULL OR "weight" >= 0)
  AND ("questionCap" IS NULL OR "questionCap" BETWEEN 1 AND 1000)
);

ALTER TABLE "PracticeQuizAdaptiveElementOverride"
ADD CONSTRAINT "pqae_discrimination_check"
CHECK (
  "discrimination" IS NULL
  OR ("discrimination" > 0 AND "discrimination" <= 10)
);

ALTER TABLE "PracticeQuizAdaptivePoolItem"
ADD CONSTRAINT "pqapi_values_check"
CHECK (
  "elementVersion" > 0
  AND "levelOrder" >= 0
  AND "discrimination" > 0 AND "discrimination" <= 10
  AND "difficulty" BETWEEN -10 AND 10
  AND "guessing" >= 0 AND "guessing" < 1
  AND cardinality("nodePath") > 0
  AND cardinality("nodePath") = cardinality("nodeNamePath")
);

-- Override navigation keeps its existing single-column relations; these
-- composite constraints add the missing same-tree guarantees.
ALTER TABLE "PracticeQuizAdaptiveNodeOverride"
ADD CONSTRAINT "pqan_config_tree_same_tree_fkey"
FOREIGN KEY ("configId", "competenceTreeId")
REFERENCES "PracticeQuizAdaptiveConfig" ("id", "competenceTreeId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeQuizAdaptiveNodeOverride"
ADD CONSTRAINT "pqan_node_same_tree_fkey"
FOREIGN KEY ("competenceTreeId", "nodeId")
REFERENCES "CompetenceTreeNode" ("treeId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeQuizAdaptiveElementOverride"
ADD CONSTRAINT "pqae_config_tree_same_tree_fkey"
FOREIGN KEY ("configId", "competenceTreeId")
REFERENCES "PracticeQuizAdaptiveConfig" ("id", "competenceTreeId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeQuizAdaptiveElementOverride"
ADD CONSTRAINT "pqae_assignment_same_tree_fkey"
FOREIGN KEY ("competenceTreeId", "assignmentId")
REFERENCES "CompetenceTreeElementAssignment" ("treeId", "id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeQuizAdaptivePoolItem"
ADD CONSTRAINT "PracticeQuizAdaptivePoolItem_configId_fkey"
FOREIGN KEY ("configId")
REFERENCES "PracticeQuizAdaptiveConfig" ("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeQuizAdaptivePoolItem"
ADD CONSTRAINT "PracticeQuizAdaptivePoolItem_sourceAssignmentId_fkey"
FOREIGN KEY ("sourceAssignmentId")
REFERENCES "CompetenceTreeElementAssignment" ("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PracticeQuizAdaptivePoolItem"
ADD CONSTRAINT "pqapi_config_tree_same_tree_fkey"
FOREIGN KEY ("configId", "competenceTreeId")
REFERENCES "PracticeQuizAdaptiveConfig" ("id", "competenceTreeId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PracticeQuizAdaptivePoolItem"
ADD CONSTRAINT "pqapi_assignment_same_tree_fkey"
FOREIGN KEY ("competenceTreeId", "sourceAssignmentId")
REFERENCES "CompetenceTreeElementAssignment" ("treeId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PracticeQuizAdaptivePoolItem"
ADD CONSTRAINT "pqapi_leaf_same_tree_fkey"
FOREIGN KEY ("competenceTreeId", "leafNodeId")
REFERENCES "CompetenceTreeNode" ("treeId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PracticeQuizAdaptivePoolItem"
ADD CONSTRAINT "pqapi_level_same_tree_fkey"
FOREIGN KEY ("competenceTreeId", "levelId")
REFERENCES "CompetenceTreeLevel" ("treeId", "id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AdaptivePracticeQuizAttempt"
DROP CONSTRAINT "AdaptivePracticeQuizAttempt_configId_fkey";

ALTER TABLE "AdaptivePracticeQuizResponse"
ADD CONSTRAINT "apqr_pool_item_required_check"
CHECK ("poolItemId" IS NOT NULL) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizResponse"
DROP CONSTRAINT "AdaptivePracticeQuizResponse_attemptId_fkey";

ALTER TABLE "AdaptivePracticeQuizAttempt"
DROP CONSTRAINT "AdaptivePracticeQuizAttempt_practiceQuizId_fkey";

ALTER TABLE "AdaptivePracticeQuizAttempt"
DROP CONSTRAINT "AdaptivePracticeQuizAttempt_participationId_fkey";

ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD CONSTRAINT "AdaptivePracticeQuizAttempt_configId_practiceQuizId_fkey"
FOREIGN KEY ("configId", "practiceQuizId")
REFERENCES "PracticeQuizAdaptiveConfig" ("id", "practiceQuizId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD CONSTRAINT "AdaptivePracticeQuizAttempt_practiceQuizId_courseId_fkey"
FOREIGN KEY ("practiceQuizId", "courseId")
REFERENCES "PracticeQuiz" ("id", "courseId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD CONSTRAINT "AdaptivePracticeQuizAttempt_participationId_participantId_courseId_fkey"
FOREIGN KEY ("participationId", "participantId", "courseId")
REFERENCES "Participation" ("id", "participantId", "courseId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdaptivePracticeQuizResponse"
ADD CONSTRAINT "AdaptivePracticeQuizResponse_attemptId_configId_fkey"
FOREIGN KEY ("attemptId", "configId")
REFERENCES "AdaptivePracticeQuizAttempt" ("id", "configId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AdaptivePracticeQuizAttempt"
ADD CONSTRAINT "AdaptivePracticeQuizAttempt_configId_nextPoolItemId_fkey"
FOREIGN KEY ("configId", "nextPoolItemId")
REFERENCES "PracticeQuizAdaptivePoolItem" ("configId", "id")
ON DELETE NO ACTION ON UPDATE CASCADE;

ALTER TABLE "AdaptivePracticeQuizResponse"
ADD CONSTRAINT "AdaptivePracticeQuizResponse_configId_poolItemId_assignmentId_elementId_fkey"
FOREIGN KEY ("configId", "poolItemId", "assignmentId", "elementId")
REFERENCES "PracticeQuizAdaptivePoolItem" ("configId", "id", "sourceAssignmentId", "elementId")
ON DELETE NO ACTION ON UPDATE CASCADE;
