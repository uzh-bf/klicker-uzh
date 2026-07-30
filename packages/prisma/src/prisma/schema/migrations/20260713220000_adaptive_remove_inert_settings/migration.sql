-- Remove adaptive settings that never affect participant delivery. Completion
-- results remain mandatory product behavior, not a configurable database flag.
BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE "PracticeQuizAdaptiveConfig"
DROP CONSTRAINT "pqac_numeric_bounds_check",
DROP CONSTRAINT "pqac_preset_semantics_check",
DROP CONSTRAINT "pqac_final_result_required_check";

ALTER TABLE "PracticeQuizAdaptiveConfig"
DROP COLUMN "standardErrorThreshold",
DROP COLUMN "showFinalResult",
DROP COLUMN "showLiveEstimate",
DROP COLUMN "enableSelfAssessmentWarmup";

ALTER TABLE "PracticeQuizAdaptiveConfig"
ADD CONSTRAINT "pqac_numeric_bounds_check"
CHECK (
  "totalQuestionCap" BETWEEN 1 AND 1000
  AND ("perLeafQuestionCap" IS NULL OR "perLeafQuestionCap" BETWEEN 1 AND "totalQuestionCap")
  AND "minQuestionsPerLeaf" BETWEEN 1 AND "totalQuestionCap"
  AND "classificationZ" > 0 AND "classificationZ" <= 5
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
    AND "topInformationRatio" = 0.8
    AND "defaultDiscrimination" = 1.2
  )
  OR (
    "preset" = 'DIAGNOSTIC'
    AND "levelMappingRule" = 'NEAREST'
    AND "attemptSelectionPolicy" = 'LATEST_COMPLETED'
    AND "topInformationRatio" = 0.8
    AND "defaultDiscrimination" = 1.2
  )
  OR "preset" = 'RESEARCH'
);

COMMIT;
