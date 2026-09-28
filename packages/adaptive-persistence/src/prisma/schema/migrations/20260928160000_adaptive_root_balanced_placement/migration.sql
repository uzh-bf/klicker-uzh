BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE "PracticeQuizAdaptiveConfig"
  DROP CONSTRAINT "pqac_preset_semantics_check";

ALTER TABLE "PracticeQuizAdaptiveConfig"
  ADD CONSTRAINT "pqac_preset_semantics_check" CHECK (
    (
      "measurementVersion" = 'IRT_V1'::"AdaptiveMeasurementVersion"
      AND (
        (
          "preset" = 'PLACEMENT'::"AdaptivePracticeQuizPreset"
          AND "levelMappingRule" = 'MASTERY'::"AdaptiveLevelMappingRule"
          AND "attemptSelectionPolicy" = 'FIRST_COMPLETED'::"AdaptiveAttemptSelectionPolicy"
          AND "topInformationRatio" = 0.8
          AND "defaultDiscrimination" = 1.2
        )
        OR (
          "preset" = 'DIAGNOSTIC'::"AdaptivePracticeQuizPreset"
          AND "levelMappingRule" = 'NEAREST'::"AdaptiveLevelMappingRule"
          AND "attemptSelectionPolicy" = 'LATEST_COMPLETED'::"AdaptiveAttemptSelectionPolicy"
          AND "topInformationRatio" = 0.8
          AND "defaultDiscrimination" = 1.2
        )
        OR "preset" = 'RESEARCH'::"AdaptivePracticeQuizPreset"
      )
    )
    OR (
      "measurementVersion" = 'IRT_V2_EAP_GRID_1'::"AdaptiveMeasurementVersion"
      AND (
        (
          "preset" = 'PLACEMENT'::"AdaptivePracticeQuizPreset"
          AND "levelMappingRule" = 'NEAREST'::"AdaptiveLevelMappingRule"
          AND "attemptSelectionPolicy" = 'LATEST_COMPLETED'::"AdaptiveAttemptSelectionPolicy"
          AND "topInformationRatio" = 0.8
          AND "defaultDiscrimination" = 1.2
          AND "totalQuestionCap" <= 60
        )
        OR (
          "preset" = 'DIAGNOSTIC'::"AdaptivePracticeQuizPreset"
          AND "levelMappingRule" = 'NEAREST'::"AdaptiveLevelMappingRule"
          AND "attemptSelectionPolicy" = 'LATEST_COMPLETED'::"AdaptiveAttemptSelectionPolicy"
          AND "topInformationRatio" = 0.8
          AND "defaultDiscrimination" = 1.2
        )
        OR "preset" = 'RESEARCH'::"AdaptivePracticeQuizPreset"
      )
    )
  ) NOT VALID;

ALTER TABLE "PracticeQuizAdaptiveConfig"
  VALIDATE CONSTRAINT "pqac_preset_semantics_check";

ALTER TABLE "PracticeQuizAdaptivePublication"
  DROP CONSTRAINT "pqap_overall_placement_pilot_policy_check";

ALTER TABLE "PracticeQuizAdaptivePublication"
  ADD CONSTRAINT "pqap_placement_stopping_policy_check" CHECK (
    (
      (
        "measurementVersion" = 'IRT_V2_EAP_GRID_1'::"AdaptiveMeasurementVersion"
        AND "preset" = 'PLACEMENT'::"AdaptivePracticeQuizPreset"
      ) = (
        "stoppingPolicyVersion" IN (
          'IRT_V2_OVERALL_PLACEMENT_PILOT_1',
          'IRT_V2_ROOT_BALANCED_PLACEMENT_1'
        )
      )
      AND (
        "stoppingPolicyVersion" <> 'IRT_V2_OVERALL_PLACEMENT_PILOT_1'
        OR (
          "researchAllocationPolicy" = 'null'::jsonb
          AND "classificationProbabilityThreshold" = 0.8
          AND "totalQuestionCap" <= 50
          AND ("evidenceMinimumSnapshot"->>'minimumResponsesPerLeaf')::integer >= 4
          AND ("evidenceMinimumSnapshot"->>'minimumResponsesPerRoot')::integer >= 4
          AND "evidenceMinimumSnapshot"->>'levelMappingRule' = 'NEAREST'
          AND "retakePolicy" = 'LATEST_COMPLETED'::"AdaptiveAttemptSelectionPolicy"
        )
      )
      AND (
        "stoppingPolicyVersion" <> 'IRT_V2_ROOT_BALANCED_PLACEMENT_1'
        OR (
          "researchAllocationPolicy" = 'null'::jsonb
          AND "classificationProbabilityThreshold" = 0.8
          AND "totalQuestionCap" <= 60
          AND ("evidenceMinimumSnapshot"->>'minimumResponsesPerRoot')::integer >= 4
          AND "evidenceMinimumSnapshot"->>'levelMappingRule' = 'NEAREST'
          AND "retakePolicy" = 'LATEST_COMPLETED'::"AdaptiveAttemptSelectionPolicy"
        )
      )
    ) IS TRUE
  ) NOT VALID;

ALTER TABLE "PracticeQuizAdaptivePublication"
  VALIDATE CONSTRAINT "pqap_placement_stopping_policy_check";

-- Preserve immutable snapshots and calibration identities for both placement policies.
CREATE OR REPLACE FUNCTION adaptive_pool_snapshot_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  publication_record record;
  calibration_record record;
BEGIN
  SELECT
    "scaleVersionId",
    "measurementVersion",
    "sealedAt",
    "unpublishedAt",
    "preset",
    "stoppingPolicyVersion"
  INTO publication_record
  FROM "PracticeQuizAdaptivePublication"
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD."publicationId" ELSE NEW."publicationId" END;

  IF TG_OP = 'UPDATE' AND publication_record."sealedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Sealed adaptive pool rows are immutable';
  END IF;
  IF TG_OP = 'DELETE' AND publication_record."sealedAt" IS NOT NULL
     AND (
       publication_record."unpublishedAt" IS NULL
       OR EXISTS (
         SELECT 1 FROM "AdaptivePracticeQuizAttempt" attempt
         WHERE attempt."publicationId" = OLD."publicationId"
       )
     ) THEN
    RAISE EXCEPTION 'Active adaptive pool rows and pools with attempts cannot be deleted';
  END IF;
  IF TG_OP = 'INSERT' AND publication_record."sealedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Items cannot be added to a sealed adaptive pool';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT version, status, model, "modelImplementationVersion", discrimination, difficulty, guessing
  INTO calibration_record
  FROM "AdaptiveItemCalibration" WHERE id = NEW."calibrationId";

  IF publication_record."scaleVersionId" IS DISTINCT FROM NEW."scaleVersionId"
     OR publication_record."measurementVersion" IS DISTINCT FROM NEW."measurementVersion"
     OR calibration_record.version IS DISTINCT FROM NEW."calibrationVersion"
     OR calibration_record.status IS DISTINCT FROM NEW."calibrationStatus"
     OR calibration_record.model IS DISTINCT FROM NEW."itemModel"
     OR calibration_record."modelImplementationVersion" IS DISTINCT FROM NEW."modelImplementationVersion" THEN
    RAISE EXCEPTION 'Adaptive pool snapshots must match their publication and calibration identities';
  END IF;

  IF NEW."measurementVersion" = 'IRT_V2_EAP_GRID_1'::"AdaptiveMeasurementVersion"
     AND (
       (
         NEW.role = 'SCORING'::"AdaptivePoolItemRole"
         AND calibration_record.status <> 'CALIBRATED'::"AdaptiveItemCalibrationStatus"
         AND NOT (
           publication_record."preset" = 'PLACEMENT'::"AdaptivePracticeQuizPreset"
           AND publication_record."stoppingPolicyVersion" IN (
             'IRT_V2_OVERALL_PLACEMENT_PILOT_1',
             'IRT_V2_ROOT_BALANCED_PLACEMENT_1'
           )
           AND calibration_record.status IN (
             'PROVISIONAL'::"AdaptiveItemCalibrationStatus",
             'PILOT'::"AdaptiveItemCalibrationStatus"
           )
         )
       )
       OR (
         NEW.role = 'ANCHOR'::"AdaptivePoolItemRole"
         AND calibration_record.status <> 'CALIBRATED'::"AdaptiveItemCalibrationStatus"
       )
       OR (
         NEW.role = 'FIELD_TEST'::"AdaptivePoolItemRole"
         AND calibration_record.status NOT IN (
           'PROVISIONAL'::"AdaptiveItemCalibrationStatus",
           'PILOT'::"AdaptiveItemCalibrationStatus"
         )
       )
       OR calibration_record.discrimination IS DISTINCT FROM NEW.discrimination
       OR calibration_record.difficulty IS DISTINCT FROM NEW.difficulty
       OR calibration_record.guessing IS DISTINCT FROM NEW.guessing
     ) THEN
    RAISE EXCEPTION 'IRT v2 scoring pools require exact approved calibration parameters';
  END IF;
  RETURN NEW;
END $$;

COMMIT;
