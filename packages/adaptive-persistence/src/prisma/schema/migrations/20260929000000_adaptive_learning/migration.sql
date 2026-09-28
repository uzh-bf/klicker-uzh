-- Initial adaptive-learning schema for the first shared deployment.
-- Consolidates the local-only development migrations. No adaptive data backfill
-- is required: staging/production have never applied the former history.
-- Keep final database constraints and immutable-publication guards intact.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';
SET LOCAL check_function_bodies = false;

ALTER TYPE public."ObjectType" ADD VALUE 'COMPETENCE_TREE';

-- TYPE: AdaptiveAssessmentAttemptStatus
CREATE TYPE public."AdaptiveAssessmentAttemptStatus" AS ENUM (
    'IN_PROGRESS',
    'COMPLETED',
    'ABANDONED'
);

-- TYPE: AdaptiveAttemptSelectionPolicy
CREATE TYPE public."AdaptiveAttemptSelectionPolicy" AS ENUM (
    'FIRST_COMPLETED',
    'LATEST_COMPLETED'
);

-- TYPE: AdaptiveCalibrationExportStatus
CREATE TYPE public."AdaptiveCalibrationExportStatus" AS ENUM (
    'REQUESTED',
    'RUNNING',
    'READY',
    'FAILED',
    'EXPIRED'
);

-- TYPE: AdaptiveEmpiricalValidationStatus
CREATE TYPE public."AdaptiveEmpiricalValidationStatus" AS ENUM (
    'SUBMITTED',
    'APPROVED',
    'REJECTED',
    'SUPERSEDED'
);

-- TYPE: AdaptiveEstimateNodeKind
CREATE TYPE public."AdaptiveEstimateNodeKind" AS ENUM (
    'OVERALL',
    'COMPETENCE',
    'SUBCOMPETENCE'
);

-- TYPE: AdaptiveItemCalibrationStatus
CREATE TYPE public."AdaptiveItemCalibrationStatus" AS ENUM (
    'PROVISIONAL',
    'PILOT',
    'CALIBRATED',
    'FLAGGED',
    'RETIRED'
);

-- TYPE: AdaptiveItemModel
CREATE TYPE public."AdaptiveItemModel" AS ENUM (
    'TWO_PL',
    'THREE_PL_FIXED_C'
);

-- TYPE: AdaptiveLevelMappingRule
CREATE TYPE public."AdaptiveLevelMappingRule" AS ENUM (
    'NEAREST',
    'MASTERY'
);

-- TYPE: AdaptiveMeasurementVersion
CREATE TYPE public."AdaptiveMeasurementVersion" AS ENUM (
    'IRT_V1',
    'IRT_V2_EAP_GRID_1'
);

-- TYPE: AdaptiveNodeKind
CREATE TYPE public."AdaptiveNodeKind" AS ENUM (
    'COMPETENCE',
    'SUBCOMPETENCE'
);

-- TYPE: AdaptivePoolItemRole
CREATE TYPE public."AdaptivePoolItemRole" AS ENUM (
    'SCORING',
    'ANCHOR',
    'FIELD_TEST'
);

-- TYPE: AdaptivePracticeQuizAttemptStatus
CREATE TYPE public."AdaptivePracticeQuizAttemptStatus" AS ENUM (
    'IN_PROGRESS',
    'COMPLETED',
    'ABANDONED'
);

-- TYPE: AdaptivePracticeQuizPreset
CREATE TYPE public."AdaptivePracticeQuizPreset" AS ENUM (
    'PLACEMENT',
    'DIAGNOSTIC',
    'RESEARCH'
);

-- TYPE: AdaptivePracticeQuizStopReason
CREATE TYPE public."AdaptivePracticeQuizStopReason" AS ENUM (
    'CLASSIFIED',
    'ALL_ROOTS_CLASSIFIED',
    'TOTAL_QUESTION_CAP',
    'NODE_QUESTION_CAP',
    'POOL_EXHAUSTED',
    'INSUFFICIENT_DATA',
    'ABANDONED',
    'TIME_LIMIT'
);

-- TYPE: AdaptiveResultStatus
CREATE TYPE public."AdaptiveResultStatus" AS ENUM (
    'CLASSIFIED',
    'BETWEEN_LEVELS',
    'INSUFFICIENT_EVIDENCE',
    'POOL_LIMITED',
    'RESEARCH_ONLY'
);

-- TYPE: AdaptiveScaleLinkStatus
CREATE TYPE public."AdaptiveScaleLinkStatus" AS ENUM (
    'DRAFT',
    'IN_REVIEW',
    'APPROVED',
    'REJECTED',
    'SUPERSEDED'
);

-- TYPE: AdaptiveScaleVersionStatus
CREATE TYPE public."AdaptiveScaleVersionStatus" AS ENUM (
    'DRAFT',
    'IN_REVIEW',
    'APPROVED',
    'ACTIVE',
    'REJECTED',
    'SUPERSEDED'
);

-- TYPE: PracticeQuizMode
CREATE TYPE public."PracticeQuizMode" AS ENUM (
    'STANDARD',
    'ADAPTIVE'
);

-- FUNCTION: adaptive_assert_scale_geometry(uuid)
CREATE FUNCTION public.adaptive_assert_scale_geometry(scale_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  scale_record record;
  level_count integer;
  minimum_order integer;
  maximum_order integer;
  distinct_order_count integer;
BEGIN
  SELECT "gridMin", "gridMax" INTO scale_record
  FROM "CompetenceTreeScaleVersion"
  WHERE id = scale_id;

  SELECT count(*), min("order"), max("order"), count(DISTINCT "order")
  INTO level_count, minimum_order, maximum_order, distinct_order_count
  FROM "CompetenceTreeScaleLevel"
  WHERE "scaleVersionId" = scale_id;

  IF level_count = 0
     OR minimum_order <> 0
     OR maximum_order <> level_count - 1
     OR distinct_order_count <> level_count THEN
    RAISE EXCEPTION 'A reviewed scale requires non-empty contiguous zero-based levels';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        "order",
        "lowerBound",
        "itemDifficultyPrior",
        lag("itemDifficultyPrior") OVER (ORDER BY "order") AS previous_prior,
        lag("lowerBound") OVER (ORDER BY "order") AS previous_lower
      FROM "CompetenceTreeScaleLevel"
      WHERE "scaleVersionId" = scale_id
    ) level
    WHERE (level."order" = 0 AND level."lowerBound" IS NOT NULL)
       OR (level."order" > 0 AND level."lowerBound" IS NULL)
       OR level."itemDifficultyPrior" < scale_record."gridMin"
       OR level."itemDifficultyPrior" > scale_record."gridMax"
       OR (level."lowerBound" IS NOT NULL AND (level."lowerBound" < scale_record."gridMin" OR level."lowerBound" > scale_record."gridMax"))
       OR (level."order" > 0 AND level."itemDifficultyPrior" <= level.previous_prior)
       OR (level."order" > 1 AND level."lowerBound" <= level.previous_lower)
       OR (level."order" > 0 AND (level."lowerBound" <= level.previous_prior OR level."lowerBound" > level."itemDifficultyPrior"))
  ) THEN
    RAISE EXCEPTION 'Scale cuts and item-difficulty priors must be finite, ordered, and inside the scale grid';
  END IF;
END $$;

-- FUNCTION: adaptive_attempt_publication_guard()
CREATE FUNCTION public.adaptive_attempt_publication_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  publication_measurement "AdaptiveMeasurementVersion";
  pool_role "AdaptivePoolItemRole";
BEGIN
  SELECT publication."measurementVersion"
  INTO publication_measurement
  FROM "PracticeQuizAdaptivePublication" publication
  WHERE publication.id = NEW."publicationId" AND publication."sealedAt" IS NOT NULL;

  IF publication_measurement IS NULL THEN
    RAISE EXCEPTION 'Adaptive attempts require a sealed publication';
  END IF;
  IF publication_measurement IS DISTINCT FROM NEW."measurementVersion" THEN
    RAISE EXCEPTION 'Adaptive attempt estimator identity must match its publication';
  END IF;
  IF NEW."nextPoolItemId" IS NOT NULL THEN
    SELECT role INTO pool_role
    FROM "PracticeQuizAdaptivePoolItem"
    WHERE "publicationId" = NEW."publicationId" AND id = NEW."nextPoolItemId";
    IF pool_role IS NULL THEN
      RAISE EXCEPTION 'Adaptive attempt next item must belong to its publication';
    END IF;
    IF publication_measurement = 'IRT_V2_EAP_GRID_1'::"AdaptiveMeasurementVersion"
       AND pool_role IS DISTINCT FROM NEW."nextItemRole" THEN
      RAISE EXCEPTION 'Adaptive attempt delivery identity must match its next pool item';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- FUNCTION: adaptive_calibration_immutability_guard()
CREATE FUNCTION public.adaptive_calibration_immutability_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Calibration records cannot be deleted';
  END IF;
  IF to_jsonb(NEW) - ARRAY['status', 'approvedById', 'approvedAt', 'updatedAt']::text[]
     IS DISTINCT FROM
     to_jsonb(OLD) - ARRAY['status', 'approvedById', 'approvedAt', 'updatedAt']::text[] THEN
    RAISE EXCEPTION 'Calibration parameters are immutable; create a new calibration version';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (
       (OLD.status = 'PROVISIONAL'::"AdaptiveItemCalibrationStatus" AND NEW.status IN (
         'PILOT'::"AdaptiveItemCalibrationStatus",
         'FLAGGED'::"AdaptiveItemCalibrationStatus",
         'RETIRED'::"AdaptiveItemCalibrationStatus"
       ))
       OR (OLD.status = 'PILOT'::"AdaptiveItemCalibrationStatus" AND NEW.status IN (
         'CALIBRATED'::"AdaptiveItemCalibrationStatus",
         'FLAGGED'::"AdaptiveItemCalibrationStatus",
         'RETIRED'::"AdaptiveItemCalibrationStatus"
       ))
       OR (OLD.status = 'CALIBRATED'::"AdaptiveItemCalibrationStatus" AND NEW.status IN (
         'FLAGGED'::"AdaptiveItemCalibrationStatus",
         'RETIRED'::"AdaptiveItemCalibrationStatus"
       ))
       OR (OLD.status = 'FLAGGED'::"AdaptiveItemCalibrationStatus" AND NEW.status IN (
         'CALIBRATED'::"AdaptiveItemCalibrationStatus",
         'RETIRED'::"AdaptiveItemCalibrationStatus"
       ))
     ) THEN
    RAISE EXCEPTION 'Invalid adaptive calibration status transition';
  END IF;
  RETURN NEW;
END $$;

-- FUNCTION: adaptive_independent_review_guard()
CREATE FUNCTION public.adaptive_independent_review_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  creator_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'CompetenceTreeScaleApproval' THEN
    SELECT "createdById" INTO creator_id FROM "CompetenceTreeScaleVersion" WHERE id = NEW."scaleVersionId";
    IF NEW."reviewerId" IS NOT NULL AND creator_id IS NOT NULL AND creator_id = NEW."reviewerId" THEN
      RAISE EXCEPTION 'A scale creator cannot review their own scale';
    END IF;
  ELSIF TG_TABLE_NAME = 'CompetenceTreeScaleLink' THEN
    IF NEW."reviewedById" IS NOT NULL AND NEW."createdById" IS NOT NULL AND NEW."reviewedById" = NEW."createdById" THEN
      RAISE EXCEPTION 'A scale-link creator cannot review their own link';
    END IF;
  ELSIF TG_TABLE_NAME = 'AdaptiveItemCalibration' THEN
    IF NEW."approvedById" IS NOT NULL AND NEW."createdById" IS NOT NULL AND NEW."approvedById" = NEW."createdById" THEN
      RAISE EXCEPTION 'A calibration creator cannot approve their own calibration';
    END IF;
  ELSIF TG_TABLE_NAME = 'AdaptivePracticeQuizEmpiricalValidation' THEN
    IF TG_OP = 'INSERT' AND NOT (
      (
        NEW.status = 'SUBMITTED'::"AdaptiveEmpiricalValidationStatus"
        AND NEW."approvedById" IS NULL
        AND NEW."reviewedAt" IS NULL
      )
      OR (
        NEW.status = 'REJECTED'::"AdaptiveEmpiricalValidationStatus"
        AND NEW."approvedById" IS NULL
        AND NEW."reviewedAt" IS NULL
      )
    ) THEN
      RAISE EXCEPTION 'Empirical-validation evidence must enter an unreviewed lifecycle state';
    END IF;
    IF NEW."approvedById" IS NOT NULL AND NEW."submittedById" IS NOT NULL AND NEW."approvedById" = NEW."submittedById" THEN
      RAISE EXCEPTION 'A validation submitter cannot approve their own evidence';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- FUNCTION: adaptive_pool_snapshot_guard()
CREATE FUNCTION public.adaptive_pool_snapshot_guard() RETURNS trigger
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
             'IRT_V2_ROOT_BALANCED_PLACEMENT_1',
             'IRT_V2_FOCUSED_ROOT_BALANCED_PLACEMENT_1'
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

-- FUNCTION: adaptive_publication_guard()
CREATE FUNCTION public.adaptive_publication_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  quiz_preset "AdaptivePracticeQuizPreset";
  validation_status "AdaptiveEmpiricalValidationStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."sealedAt" IS NOT NULL AND (
      OLD."unpublishedAt" IS NULL
      OR EXISTS (
        SELECT 1 FROM "AdaptivePracticeQuizAttempt" attempt
        WHERE attempt."publicationId" = OLD.id
      )
    ) THEN
      RAISE EXCEPTION 'Active adaptive publications and publications with attempts cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND (
    to_jsonb(NEW) - ARRAY['sealedAt', 'supersededAt', 'unpublishedAt']::text[]
    IS DISTINCT FROM
    to_jsonb(OLD) - ARRAY['sealedAt', 'supersededAt', 'unpublishedAt']::text[]
  ) THEN
    RAISE EXCEPTION 'Published adaptive measurement snapshots are immutable';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."sealedAt" IS NOT NULL AND NEW."sealedAt" IS DISTINCT FROM OLD."sealedAt" THEN
    RAISE EXCEPTION 'Adaptive publications cannot be unsealed or resealed';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD."supersededAt" IS NOT NULL
     AND NEW."supersededAt" IS DISTINCT FROM OLD."supersededAt" THEN
    RAISE EXCEPTION 'Adaptive publication supersession is monotonic';
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD."unpublishedAt" IS NOT NULL
     AND NEW."unpublishedAt" IS DISTINCT FROM OLD."unpublishedAt" THEN
    RAISE EXCEPTION 'Adaptive publication withdrawal is monotonic';
  END IF;

  IF NEW."sealedAt" IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD."sealedAt" IS NULL)
     AND NOT EXISTS (
       SELECT 1 FROM "PracticeQuizAdaptivePoolItem" pool WHERE pool."publicationId" = NEW.id
     ) THEN
    RAISE EXCEPTION 'An adaptive publication cannot be sealed with an empty pool';
  END IF;

  IF NEW."empiricalValidationId" IS NOT NULL THEN
    SELECT status INTO validation_status
    FROM "AdaptivePracticeQuizEmpiricalValidation"
    WHERE id = NEW."empiricalValidationId";
    IF validation_status IS DISTINCT FROM 'APPROVED'::"AdaptiveEmpiricalValidationStatus" THEN
      RAISE EXCEPTION 'Only approved empirical validation may be attached to a publication';
    END IF;
  END IF;

  IF NEW."measurementVersion" = 'IRT_V2_EAP_GRID_1'::"AdaptiveMeasurementVersion" THEN
    SELECT preset INTO quiz_preset FROM "PracticeQuizAdaptiveConfig" WHERE id = NEW."configId";
    IF quiz_preset = 'DIAGNOSTIC'::"AdaptivePracticeQuizPreset" AND NEW."empiricalValidationId" IS NULL THEN
      RAISE EXCEPTION 'Diagnostic IRT v2 publication requires approved holdout validation';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- FUNCTION: adaptive_response_design_guard()
CREATE FUNCTION public.adaptive_response_design_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  pool_role "AdaptivePoolItemRole";
  attempt_record RECORD;
BEGIN
  IF NEW."poolItemId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role INTO pool_role
  FROM "PracticeQuizAdaptivePoolItem"
  WHERE "publicationId" = NEW."publicationId" AND id = NEW."poolItemId";

  IF pool_role IS DISTINCT FROM NEW."itemRole"
     OR NEW."isCalibrationAnchor" IS DISTINCT FROM (pool_role = 'ANCHOR'::"AdaptivePoolItemRole") THEN
    RAISE EXCEPTION 'Adaptive response design identity must match the served pool item';
  END IF;
  SELECT
    "measurementVersion",
    "nextPoolItemId",
    "nextAdministrationProbability",
    "nextCollectionDesignVersion",
    "nextRandomizationVersion",
    "nextRandomDraw",
    "nextCandidateSetHash",
    "nextItemRole"
  INTO attempt_record
  FROM "AdaptivePracticeQuizAttempt"
  WHERE id = NEW."attemptId";

  IF attempt_record."measurementVersion" = 'IRT_V2_EAP_GRID_1'::"AdaptiveMeasurementVersion"
     AND (
       attempt_record."nextPoolItemId" IS DISTINCT FROM NEW."poolItemId"
       OR attempt_record."nextAdministrationProbability" IS DISTINCT FROM NEW."administrationProbability"
       OR attempt_record."nextCollectionDesignVersion" IS DISTINCT FROM NEW."collectionDesignVersion"
       OR attempt_record."nextRandomizationVersion" IS DISTINCT FROM NEW."randomizationVersion"
       OR attempt_record."nextRandomDraw" IS DISTINCT FROM NEW."randomDraw"
       OR attempt_record."nextCandidateSetHash" IS DISTINCT FROM NEW."candidateSetHash"
       OR attempt_record."nextItemRole" IS DISTINCT FROM NEW."itemRole"
     ) THEN
    RAISE EXCEPTION 'Adaptive response audit identity must match the served delivery';
  END IF;
  RETURN NEW;
END $$;

-- FUNCTION: adaptive_review_evidence_immutability_guard()
CREATE FUNCTION public.adaptive_review_evidence_immutability_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Adaptive review evidence cannot be deleted';
  END IF;

  IF TG_TABLE_NAME = 'CompetenceTreeScaleApproval'
     AND to_jsonb(NEW) - ARRAY['decision', 'reviewerId', 'reviewedAt']::text[]
         IS DISTINCT FROM
         to_jsonb(OLD) - ARRAY['decision', 'reviewerId', 'reviewedAt']::text[] THEN
    RAISE EXCEPTION 'Submitted standard-setting evidence is immutable';
  END IF;

  IF TG_TABLE_NAME = 'AdaptivePracticeQuizEmpiricalValidation' THEN
    IF to_jsonb(NEW) - ARRAY['status', 'approvedById', 'reviewedAt', 'updatedAt']::text[]
       IS DISTINCT FROM
       to_jsonb(OLD) - ARRAY['status', 'approvedById', 'reviewedAt', 'updatedAt']::text[] THEN
      RAISE EXCEPTION 'Submitted empirical-validation evidence is immutable';
    END IF;

    IF NEW.status = OLD.status THEN
      IF NEW."approvedById" IS DISTINCT FROM OLD."approvedById"
         OR NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt" THEN
        RAISE EXCEPTION 'Empirical-validation review identity is immutable';
      END IF;
    ELSIF OLD.status = 'SUBMITTED'::"AdaptiveEmpiricalValidationStatus"
          AND NEW.status IN (
            'APPROVED'::"AdaptiveEmpiricalValidationStatus",
            'REJECTED'::"AdaptiveEmpiricalValidationStatus"
          ) THEN
      IF NEW."approvedById" IS NULL OR NEW."reviewedAt" IS NULL THEN
        RAISE EXCEPTION 'Empirical-validation review requires a reviewer and timestamp';
      END IF;
    ELSIF OLD.status = 'APPROVED'::"AdaptiveEmpiricalValidationStatus"
          AND NEW.status = 'SUPERSEDED'::"AdaptiveEmpiricalValidationStatus" THEN
      IF NEW."approvedById" IS DISTINCT FROM OLD."approvedById"
         OR NEW."reviewedAt" IS DISTINCT FROM OLD."reviewedAt" THEN
        RAISE EXCEPTION 'Empirical-validation review identity is immutable';
      END IF;
      IF EXISTS (
        SELECT 1
        FROM "PracticeQuizAdaptivePublication" publication
        WHERE publication."empiricalValidationId" = OLD.id
          AND publication."supersededAt" IS NULL
          AND publication."unpublishedAt" IS NULL
      ) THEN
        RAISE EXCEPTION 'Active adaptive publications must be invalidated before validation supersession';
      END IF;
    ELSE
      RAISE EXCEPTION 'Illegal empirical-validation status transition';
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- FUNCTION: adaptive_scale_level_guard()
CREATE FUNCTION public.adaptive_scale_level_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  scale_status "AdaptiveScaleVersionStatus";
BEGIN
  SELECT status INTO scale_status
  FROM "CompetenceTreeScaleVersion"
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD."scaleVersionId" ELSE NEW."scaleVersionId" END;

  IF scale_status IS DISTINCT FROM 'DRAFT'::"AdaptiveScaleVersionStatus" THEN
    RAISE EXCEPTION 'Scale levels are immutable after review submission';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $$;

-- FUNCTION: adaptive_scale_link_anchor_guard()
CREATE FUNCTION public.adaptive_scale_link_anchor_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  link_record record;
  from_record record;
  to_record record;
BEGIN
  SELECT "treeId", "fromScaleVersionId", "toScaleVersionId", status INTO link_record
  FROM "CompetenceTreeScaleLink"
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD."scaleLinkId" ELSE NEW."scaleLinkId" END;

  IF link_record.status IS DISTINCT FROM 'DRAFT'::"AdaptiveScaleLinkStatus" THEN
    RAISE EXCEPTION 'Scale-link anchors are immutable after review submission';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT "treeId", "scaleVersionId", "assignmentId", "elementId", "elementVersion" INTO from_record
  FROM "AdaptiveItemCalibration" WHERE id = NEW."fromCalibrationId";
  SELECT "treeId", "scaleVersionId", "assignmentId", "elementId", "elementVersion" INTO to_record
  FROM "AdaptiveItemCalibration" WHERE id = NEW."toCalibrationId";

  IF from_record."treeId" IS DISTINCT FROM link_record."treeId"
     OR to_record."treeId" IS DISTINCT FROM link_record."treeId"
     OR from_record."scaleVersionId" IS DISTINCT FROM link_record."fromScaleVersionId"
     OR to_record."scaleVersionId" IS DISTINCT FROM link_record."toScaleVersionId"
     OR from_record."assignmentId" IS DISTINCT FROM to_record."assignmentId"
     OR from_record."elementId" IS DISTINCT FROM to_record."elementId"
     OR from_record."elementVersion" IS DISTINCT FROM to_record."elementVersion" THEN
    RAISE EXCEPTION 'Scale-link anchors must pair the same item identity across the linked scales';
  END IF;
  RETURN NEW;
END $$;

-- FUNCTION: adaptive_scale_link_guard()
CREATE FUNCTION public.adaptive_scale_link_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  from_version integer;
  to_version integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.status <> 'DRAFT'::"AdaptiveScaleLinkStatus" THEN
      RAISE EXCEPTION 'Reviewed scale-link evidence cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  SELECT version INTO from_version FROM "CompetenceTreeScaleVersion" WHERE id = NEW."fromScaleVersionId";
  SELECT version INTO to_version FROM "CompetenceTreeScaleVersion" WHERE id = NEW."toScaleVersionId";
  IF from_version >= to_version THEN
    RAISE EXCEPTION 'Scale links must point from an older to a newer scale';
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status <> 'DRAFT'::"AdaptiveScaleLinkStatus" THEN
    RAISE EXCEPTION 'A scale link must be created in DRAFT';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'DRAFT'::"AdaptiveScaleLinkStatus" AND NEW.status = 'IN_REVIEW'::"AdaptiveScaleLinkStatus")
      OR (OLD.status = 'IN_REVIEW'::"AdaptiveScaleLinkStatus" AND NEW.status IN ('APPROVED'::"AdaptiveScaleLinkStatus", 'REJECTED'::"AdaptiveScaleLinkStatus"))
      OR (OLD.status = 'APPROVED'::"AdaptiveScaleLinkStatus" AND NEW.status = 'SUPERSEDED'::"AdaptiveScaleLinkStatus")
    ) THEN
      RAISE EXCEPTION 'Invalid scale-link lifecycle transition: % -> %', OLD.status, NEW.status;
    END IF;
    IF NEW.status IN ('APPROVED'::"AdaptiveScaleLinkStatus", 'REJECTED'::"AdaptiveScaleLinkStatus")
       AND (NEW."reviewedById" IS NULL OR NEW."reviewedAt" IS NULL) THEN
      RAISE EXCEPTION 'Scale-link review identity is required for a review decision';
    END IF;
    IF NEW.status = 'APPROVED'::"AdaptiveScaleLinkStatus"
       AND NOT EXISTS (SELECT 1 FROM "CompetenceTreeScaleLinkAnchor" anchor WHERE anchor."scaleLinkId" = NEW.id) THEN
      RAISE EXCEPTION 'At least one exact anchor pair is required to approve a scale link';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status <> 'DRAFT'::"AdaptiveScaleLinkStatus"
     AND to_jsonb(NEW) - ARRAY['status', 'reviewedById', 'reviewedAt', 'updatedAt']::text[]
         IS DISTINCT FROM
         to_jsonb(OLD) - ARRAY['status', 'reviewedById', 'reviewedAt', 'updatedAt']::text[] THEN
    RAISE EXCEPTION 'Reviewed scale-link evidence is immutable';
  END IF;
  RETURN NEW;
END $$;

-- FUNCTION: adaptive_scale_version_guard()
CREATE FUNCTION public.adaptive_scale_version_guard() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  previous_scale record;
BEGIN
  IF NEW."supersedesVersionId" IS NOT NULL THEN
    SELECT "treeId", "version" INTO previous_scale
    FROM "CompetenceTreeScaleVersion"
    WHERE id = NEW."supersedesVersionId";

    IF previous_scale."treeId" IS DISTINCT FROM NEW."treeId" OR previous_scale."version" >= NEW."version" THEN
      RAISE EXCEPTION 'A scale can only supersede an older version of the same tree';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status <> 'DRAFT'::"AdaptiveScaleVersionStatus" THEN
    RAISE EXCEPTION 'A scale version must be created in DRAFT';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'DRAFT'::"AdaptiveScaleVersionStatus" AND NEW.status = 'IN_REVIEW'::"AdaptiveScaleVersionStatus")
      OR (OLD.status = 'IN_REVIEW'::"AdaptiveScaleVersionStatus" AND NEW.status IN ('APPROVED'::"AdaptiveScaleVersionStatus", 'REJECTED'::"AdaptiveScaleVersionStatus"))
      OR (OLD.status = 'APPROVED'::"AdaptiveScaleVersionStatus" AND NEW.status = 'ACTIVE'::"AdaptiveScaleVersionStatus")
      OR (OLD.status = 'ACTIVE'::"AdaptiveScaleVersionStatus" AND NEW.status = 'SUPERSEDED'::"AdaptiveScaleVersionStatus")
    ) THEN
      RAISE EXCEPTION 'Invalid scale-version lifecycle transition: % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.status IN ('APPROVED'::"AdaptiveScaleVersionStatus", 'REJECTED'::"AdaptiveScaleVersionStatus")
       AND NOT EXISTS (
         SELECT 1 FROM "CompetenceTreeScaleApproval" approval
         WHERE approval."scaleVersionId" = NEW.id AND approval.decision = NEW.status
       ) THEN
      RAISE EXCEPTION 'Scale review evidence is required before a review decision';
    END IF;

    IF NEW.status = 'IN_REVIEW'::"AdaptiveScaleVersionStatus"
       AND NOT EXISTS (
         SELECT 1 FROM "CompetenceTreeScaleApproval" approval
         WHERE approval."scaleVersionId" = NEW.id AND approval.decision IS NULL
       ) THEN
      RAISE EXCEPTION 'Standard-setting evidence is required before scale review';
    END IF;

    IF NEW.status IN ('IN_REVIEW'::"AdaptiveScaleVersionStatus", 'ACTIVE'::"AdaptiveScaleVersionStatus") THEN
      PERFORM adaptive_assert_scale_geometry(NEW.id);
    END IF;

    IF NEW.status = 'ACTIVE'::"AdaptiveScaleVersionStatus"
       AND NEW."supersedesVersionId" IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM "CompetenceTreeScaleLink" link
         WHERE link."treeId" = NEW."treeId"
           AND link."fromScaleVersionId" = NEW."supersedesVersionId"
           AND link."toScaleVersionId" = NEW.id
           AND link.status = 'APPROVED'::"AdaptiveScaleLinkStatus"
       ) THEN
      RAISE EXCEPTION 'An approved scale link is required before activating a superseding scale';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.status <> 'DRAFT'::"AdaptiveScaleVersionStatus"
     AND (
       to_jsonb(NEW) - ARRAY['status', 'submittedForReviewAt', 'updatedAt']::text[]
       IS DISTINCT FROM
       to_jsonb(OLD) - ARRAY['status', 'submittedForReviewAt', 'updatedAt']::text[]
     ) THEN
    RAISE EXCEPTION 'Reviewed scale definitions are immutable';
  END IF;

  RETURN NEW;
END $$;

-- FUNCTION: invalidate_adaptive_cohort_snapshots_on_attempt_delete()
CREATE FUNCTION public.invalidate_adaptive_cohort_snapshots_on_attempt_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  UPDATE "AdaptivePracticeQuizCohortSnapshot"
  SET
    "invalidatedAt" = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "configId" IN (
    SELECT DISTINCT "configId"
    FROM deleted_adaptive_attempts
  );

  RETURN NULL;
END;
$$;


-- Extend existing host tables without changing their existing rows or columns.
ALTER TABLE public."Course"
    ADD COLUMN "isAdaptiveLearningEnabled" boolean DEFAULT false NOT NULL,
    ADD COLUMN "isAdaptiveLearningCalibrationEnabled" boolean DEFAULT false NOT NULL;
ALTER TABLE public."Element"
    ADD COLUMN "creationRequestId" uuid,
    ADD COLUMN "creationRequestFingerprint" varchar(64),
    ADD CONSTRAINT element_creation_request_identity_check CHECK (
      ("creationRequestId" IS NULL AND "creationRequestFingerprint" IS NULL)
      OR ("creationRequestId" IS NOT NULL AND "creationRequestFingerprint" IS NOT NULL
          AND "creationRequestFingerprint" ~ '^[0-9a-f]{64}$')
    );
ALTER TABLE public."PracticeQuiz"
    ADD COLUMN mode public."PracticeQuizMode" DEFAULT 'STANDARD' NOT NULL,
    ADD CONSTRAINT practice_quiz_adaptive_no_gamification_check CHECK (
      mode <> 'ADAPTIVE' OR (
        "pointsMultiplier" = 0 AND "isGamificationEnabled" = false
        AND "isAssessmentEnabled" = false
      )
    );

-- TABLE: AdaptiveAssessment
CREATE TABLE public."AdaptiveAssessment" (
    id uuid NOT NULL,
    name text NOT NULL,
    "displayName" text NOT NULL,
    description text,
    status public."PublicationStatus" DEFAULT 'DRAFT'::public."PublicationStatus" NOT NULL,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "thetaMin" double precision DEFAULT '-3'::integer NOT NULL,
    "thetaMax" double precision DEFAULT 3 NOT NULL,
    discrimination double precision DEFAULT 1.5 NOT NULL,
    "standardErrorThreshold" double precision DEFAULT 0.4 NOT NULL,
    "questionThreshold" integer DEFAULT 50 NOT NULL,
    "topInformationRatio" double precision DEFAULT 0.8 NOT NULL,
    "showTimer" boolean DEFAULT true NOT NULL,
    "showCompetenceNames" boolean DEFAULT true NOT NULL,
    "showFinalResult" boolean DEFAULT true NOT NULL,
    "courseId" uuid NOT NULL,
    "ownerId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "showSolutions" boolean DEFAULT false NOT NULL
);

-- TABLE: AdaptiveAssessmentAttempt
CREATE TABLE public."AdaptiveAssessmentAttempt" (
    id uuid NOT NULL,
    status public."AdaptiveAssessmentAttemptStatus" DEFAULT 'IN_PROGRESS'::public."AdaptiveAssessmentAttemptStatus" NOT NULL,
    "currentTheta" double precision DEFAULT 0 NOT NULL,
    "currentStandardError" double precision,
    "finalTheta" double precision,
    "finalStandardError" double precision,
    "finalLevelLabel" text,
    "elapsedSeconds" integer,
    "thetaHistory" jsonb,
    "standardErrorHistory" jsonb,
    "assessmentId" uuid NOT NULL,
    "participantId" uuid NOT NULL,
    "participationId" integer NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

-- TABLE: AdaptiveAssessmentCompetence
CREATE TABLE public."AdaptiveAssessmentCompetence" (
    id integer NOT NULL,
    name text NOT NULL,
    "tagName" text,
    enabled boolean DEFAULT true NOT NULL,
    "order" integer NOT NULL,
    weight double precision DEFAULT 1 NOT NULL,
    "assessmentId" uuid NOT NULL,
    "questionThreshold" integer,
    "standardErrorThreshold" double precision
);

-- SEQUENCE: AdaptiveAssessmentCompetence_id_seq
CREATE SEQUENCE public."AdaptiveAssessmentCompetence_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: AdaptiveAssessmentCompetence_id_seq
ALTER SEQUENCE public."AdaptiveAssessmentCompetence_id_seq" OWNED BY public."AdaptiveAssessmentCompetence".id;

-- TABLE: AdaptiveAssessmentElement
CREATE TABLE public."AdaptiveAssessmentElement" (
    id integer NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    exposure integer DEFAULT 0 NOT NULL,
    discrimination double precision,
    "assessmentId" uuid NOT NULL,
    "elementId" integer NOT NULL,
    "competenceId" integer NOT NULL,
    "subCompetenceId" integer NOT NULL,
    "levelId" integer NOT NULL
);

-- SEQUENCE: AdaptiveAssessmentElement_id_seq
CREATE SEQUENCE public."AdaptiveAssessmentElement_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: AdaptiveAssessmentElement_id_seq
ALTER SEQUENCE public."AdaptiveAssessmentElement_id_seq" OWNED BY public."AdaptiveAssessmentElement".id;

-- TABLE: AdaptiveAssessmentLevel
CREATE TABLE public."AdaptiveAssessmentLevel" (
    id integer NOT NULL,
    label text NOT NULL,
    "order" integer NOT NULL,
    "assessmentId" uuid NOT NULL
);

-- SEQUENCE: AdaptiveAssessmentLevel_id_seq
CREATE SEQUENCE public."AdaptiveAssessmentLevel_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: AdaptiveAssessmentLevel_id_seq
ALTER SEQUENCE public."AdaptiveAssessmentLevel_id_seq" OWNED BY public."AdaptiveAssessmentLevel".id;

-- TABLE: AdaptiveAssessmentResponse
CREATE TABLE public."AdaptiveAssessmentResponse" (
    id integer NOT NULL,
    "order" integer NOT NULL,
    response jsonb NOT NULL,
    correct boolean NOT NULL,
    "thetaBefore" double precision NOT NULL,
    "thetaAfter" double precision NOT NULL,
    "standardErrorAfter" double precision NOT NULL,
    "elapsedSeconds" integer,
    "attemptId" uuid NOT NULL,
    "adaptiveElementId" integer NOT NULL,
    "elementId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- SEQUENCE: AdaptiveAssessmentResponse_id_seq
CREATE SEQUENCE public."AdaptiveAssessmentResponse_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: AdaptiveAssessmentResponse_id_seq
ALTER SEQUENCE public."AdaptiveAssessmentResponse_id_seq" OWNED BY public."AdaptiveAssessmentResponse".id;

-- TABLE: AdaptiveAssessmentResultMessage
CREATE TABLE public."AdaptiveAssessmentResultMessage" (
    id integer NOT NULL,
    "order" integer NOT NULL,
    message text NOT NULL,
    "minTheta" double precision,
    "maxTheta" double precision,
    "isFallback" boolean DEFAULT false NOT NULL,
    "assessmentId" uuid NOT NULL,
    "levelId" integer
);

-- SEQUENCE: AdaptiveAssessmentResultMessage_id_seq
CREATE SEQUENCE public."AdaptiveAssessmentResultMessage_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: AdaptiveAssessmentResultMessage_id_seq
ALTER SEQUENCE public."AdaptiveAssessmentResultMessage_id_seq" OWNED BY public."AdaptiveAssessmentResultMessage".id;

-- TABLE: AdaptiveAssessmentSubCompetence
CREATE TABLE public."AdaptiveAssessmentSubCompetence" (
    id integer NOT NULL,
    name text NOT NULL,
    "tagName" text,
    enabled boolean DEFAULT true NOT NULL,
    "order" integer NOT NULL,
    "questionThreshold" integer,
    "standardErrorThreshold" double precision,
    "assessmentId" uuid NOT NULL,
    "competenceId" integer NOT NULL
);

-- SEQUENCE: AdaptiveAssessmentSubCompetence_id_seq
CREATE SEQUENCE public."AdaptiveAssessmentSubCompetence_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: AdaptiveAssessmentSubCompetence_id_seq
ALTER SEQUENCE public."AdaptiveAssessmentSubCompetence_id_seq" OWNED BY public."AdaptiveAssessmentSubCompetence".id;

-- TABLE: AdaptiveCalibrationExportRequest
CREATE TABLE public."AdaptiveCalibrationExportRequest" (
    id uuid NOT NULL,
    status public."AdaptiveCalibrationExportStatus" DEFAULT 'REQUESTED'::public."AdaptiveCalibrationExportStatus" NOT NULL,
    "treeId" uuid NOT NULL,
    "scaleVersionId" uuid NOT NULL,
    "requestedById" uuid,
    "artifactKey" text,
    "artifactChecksum" text,
    "rowCount" integer,
    "failureCode" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "datasetVersion" text NOT NULL,
    "splitPolicyVersion" text DEFAULT 'HMAC_80_20_V1'::text NOT NULL,
    "manifestArtifactKey" text,
    "manifestChecksum" text,
    "holdoutArtifactKey" text,
    "holdoutArtifactChecksum" text,
    "holdoutRowCount" integer,
    "criterionArtifactKey" text,
    "criterionArtifactChecksum" text,
    "runToken" uuid,
    CONSTRAINT acer_running_lease_check CHECK (((status = 'RUNNING'::public."AdaptiveCalibrationExportStatus") = ("runToken" IS NOT NULL))),
    CONSTRAINT acer_state_check CHECK ((((length("datasetVersion") >= 1) AND (length("datasetVersion") <= 160)) AND ((length("splitPolicyVersion") >= 1) AND (length("splitPolicyVersion") <= 160)) AND (("rowCount" IS NULL) OR ("rowCount" >= 0)) AND (("holdoutRowCount" IS NULL) OR ("holdoutRowCount" >= 0)) AND (("criterionArtifactKey" IS NULL) = ("criterionArtifactChecksum" IS NULL)) AND (("criterionArtifactChecksum" IS NULL) OR ("criterionArtifactChecksum" ~ '^[a-f0-9]{64}$'::text)) AND ("expiresAt" > "createdAt") AND ((status <> 'READY'::public."AdaptiveCalibrationExportStatus") OR (("artifactKey" IS NOT NULL) AND ("artifactChecksum" ~ '^[a-f0-9]{64}$'::text) AND ("rowCount" IS NOT NULL) AND ("manifestArtifactKey" IS NOT NULL) AND ("manifestChecksum" ~ '^[a-f0-9]{64}$'::text) AND ("holdoutArtifactKey" IS NOT NULL) AND ("holdoutArtifactChecksum" ~ '^[a-f0-9]{64}$'::text) AND ("holdoutRowCount" IS NOT NULL) AND ("completedAt" IS NOT NULL))) AND ((status <> 'FAILED'::public."AdaptiveCalibrationExportStatus") OR (("failureCode" IS NOT NULL) AND ("completedAt" IS NOT NULL)))))
);

-- COMMENT: COLUMN "AdaptiveCalibrationExportRequest"."artifactKey"
COMMENT ON COLUMN public."AdaptiveCalibrationExportRequest"."artifactKey" IS 'Worker-only opaque storage key; never expose through public GraphQL.';

-- COMMENT: COLUMN "AdaptiveCalibrationExportRequest"."manifestArtifactKey"
COMMENT ON COLUMN public."AdaptiveCalibrationExportRequest"."manifestArtifactKey" IS 'Worker-only opaque storage key; never expose through public GraphQL.';

-- COMMENT: COLUMN "AdaptiveCalibrationExportRequest"."holdoutArtifactKey"
COMMENT ON COLUMN public."AdaptiveCalibrationExportRequest"."holdoutArtifactKey" IS 'Sealed worker/reviewer-only storage key; never expose to the tree owner.';

-- COMMENT: COLUMN "AdaptiveCalibrationExportRequest"."criterionArtifactKey"
COMMENT ON COLUMN public."AdaptiveCalibrationExportRequest"."criterionArtifactKey" IS 'Sealed reviewer-provided criterion key; retained only until validation succeeds or the export expires.';

-- COMMENT: COLUMN "AdaptiveCalibrationExportRequest"."runToken"
COMMENT ON COLUMN public."AdaptiveCalibrationExportRequest"."runToken" IS 'Lease token fencing terminal updates and artifacts to one export worker run.';

-- TABLE: AdaptiveItemCalibration
CREATE TABLE public."AdaptiveItemCalibration" (
    id uuid NOT NULL,
    version integer NOT NULL,
    model public."AdaptiveItemModel" NOT NULL,
    status public."AdaptiveItemCalibrationStatus" DEFAULT 'PROVISIONAL'::public."AdaptiveItemCalibrationStatus" NOT NULL,
    discrimination double precision NOT NULL,
    difficulty double precision NOT NULL,
    guessing double precision NOT NULL,
    "parameterUncertainty" jsonb NOT NULL,
    "responseCount" integer DEFAULT 0 NOT NULL,
    "participantCount" integer DEFAULT 0 NOT NULL,
    diagnostics jsonb NOT NULL,
    "datasetVersion" text NOT NULL,
    "datasetChecksum" text NOT NULL,
    "calibrationJobId" text,
    "modelImplementationVersion" text NOT NULL,
    "elementContentChecksum" text NOT NULL,
    "treeId" uuid NOT NULL,
    "scaleVersionId" uuid NOT NULL,
    "assignmentId" integer NOT NULL,
    "elementId" integer NOT NULL,
    "elementVersion" integer NOT NULL,
    "createdById" uuid,
    "approvedById" uuid,
    "approvedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT aic_parameters_check CHECK (((version > 0) AND ("elementVersion" > 0) AND ((discrimination)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND ((difficulty)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND ((guessing)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND (discrimination > (0)::double precision) AND (guessing >= (0)::double precision) AND (guessing < (1)::double precision) AND ("responseCount" >= 0) AND ("participantCount" >= 0) AND (("approvedById" IS NULL) = ("approvedAt" IS NULL)) AND ((status <> 'CALIBRATED'::public."AdaptiveItemCalibrationStatus") OR (("approvedById" IS NOT NULL) AND ("approvedAt" IS NOT NULL)))))
);

-- COMMENT: TABLE "AdaptiveItemCalibration"
COMMENT ON TABLE public."AdaptiveItemCalibration" IS 'Immutable item-parameter version for an exact tree, scale, assignment, element, and element-version identity.';

-- TABLE: AdaptivePracticeQuizAttempt
CREATE TABLE public."AdaptivePracticeQuizAttempt" (
    id uuid NOT NULL,
    status public."AdaptivePracticeQuizAttemptStatus" DEFAULT 'IN_PROGRESS'::public."AdaptivePracticeQuizAttemptStatus" NOT NULL,
    "currentTheta" double precision DEFAULT 0 NOT NULL,
    "currentStandardError" double precision,
    "finalTheta" double precision,
    "finalStandardError" double precision,
    "finalLevelId" integer,
    "elapsedSeconds" integer,
    "configId" uuid NOT NULL,
    "practiceQuizId" uuid NOT NULL,
    "participantId" uuid NOT NULL,
    "participationId" integer NOT NULL,
    "startedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "completedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "nextPoolItemId" integer,
    "courseId" uuid NOT NULL,
    "stopReason" public."AdaptivePracticeQuizStopReason",
    "competenceTreeId" uuid NOT NULL,
    "publicationId" uuid NOT NULL,
    "scaleVersionId" uuid NOT NULL,
    "measurementVersion" public."AdaptiveMeasurementVersion" NOT NULL,
    "estimatorImplementationVersion" text NOT NULL,
    "classificationPolicyVersion" integer NOT NULL,
    "calibrationPolicyVersion" integer NOT NULL,
    "finalScaleLevelId" integer,
    "nextAdministrationProbability" double precision,
    "nextCollectionDesignVersion" text,
    "nextRandomizationVersion" text,
    "nextRandomDraw" bigint,
    "nextCandidateSetHash" text,
    "nextItemRole" public."AdaptivePoolItemRole",
    "resultStatus" public."AdaptiveResultStatus",
    "finalBandProbability" double precision,
    "credibleLower" double precision,
    "credibleUpper" double precision,
    "bandProbabilities" jsonb,
    CONSTRAINT apqa_result_check CHECK ((("classificationPolicyVersion" > 0) AND ("calibrationPolicyVersion" > 0) AND (("finalBandProbability" IS NULL) OR (("finalBandProbability" >= (0)::double precision) AND ("finalBandProbability" <= (1)::double precision) AND (("finalBandProbability")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])))) AND (("credibleLower" IS NULL) OR (("credibleLower")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))) AND (("credibleUpper" IS NULL) OR (("credibleUpper")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))) AND (("credibleLower" IS NULL) OR ("credibleUpper" IS NULL) OR ("credibleLower" <= "credibleUpper")) AND (("nextAdministrationProbability" IS NULL) OR (("nextAdministrationProbability" > (0)::double precision) AND ("nextAdministrationProbability" <= (1)::double precision) AND (("nextAdministrationProbability")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])))) AND (("nextRandomDraw" IS NULL) OR (("nextRandomDraw" >= 0) AND ("nextRandomDraw" <= '4294967295'::bigint))) AND ((("measurementVersion" = 'IRT_V1'::public."AdaptiveMeasurementVersion") AND ("nextAdministrationProbability" IS NULL) AND ("nextCollectionDesignVersion" IS NULL) AND ("nextRandomizationVersion" IS NULL) AND ("nextRandomDraw" IS NULL) AND ("nextCandidateSetHash" IS NULL) AND ("nextItemRole" IS NULL)) OR (("measurementVersion" = 'IRT_V2_EAP_GRID_1'::public."AdaptiveMeasurementVersion") AND ((("nextPoolItemId" IS NULL) AND ("nextAdministrationProbability" IS NULL) AND ("nextCollectionDesignVersion" IS NULL) AND ("nextRandomizationVersion" IS NULL) AND ("nextRandomDraw" IS NULL) AND ("nextCandidateSetHash" IS NULL) AND ("nextItemRole" IS NULL)) OR (("nextPoolItemId" IS NOT NULL) AND ("nextAdministrationProbability" IS NOT NULL) AND ("nextRandomizationVersion" IS NOT NULL) AND ("nextRandomDraw" IS NOT NULL) AND ("nextCandidateSetHash" IS NOT NULL) AND ("nextItemRole" IS NOT NULL))))))),
    CONSTRAINT apqa_runtime_state_check CHECK ((((status = 'IN_PROGRESS'::public."AdaptivePracticeQuizAttemptStatus") AND ("nextPoolItemId" IS NOT NULL) AND ("stopReason" IS NULL) AND ("completedAt" IS NULL)) OR ((status = 'COMPLETED'::public."AdaptivePracticeQuizAttemptStatus") AND ("nextPoolItemId" IS NULL) AND ("stopReason" IS NOT NULL) AND ("stopReason" <> 'ABANDONED'::public."AdaptivePracticeQuizStopReason") AND ("completedAt" IS NOT NULL)) OR ((status = 'ABANDONED'::public."AdaptivePracticeQuizAttemptStatus") AND ("nextPoolItemId" IS NULL) AND ("stopReason" = 'ABANDONED'::public."AdaptivePracticeQuizStopReason") AND ("completedAt" IS NOT NULL)))),
    CONSTRAINT apqa_runtime_values_check CHECK (((("currentTheta" >= ('-10'::integer)::double precision) AND ("currentTheta" <= (10)::double precision)) AND (("currentStandardError" IS NULL) OR ("currentStandardError" > (0)::double precision)) AND (("finalTheta" IS NULL) OR (("finalTheta" >= ('-10'::integer)::double precision) AND ("finalTheta" <= (10)::double precision))) AND (("finalStandardError" IS NULL) OR ("finalStandardError" > (0)::double precision)) AND (("elapsedSeconds" IS NULL) OR ("elapsedSeconds" >= 0))))
);

-- TABLE: AdaptivePracticeQuizCohortSnapshot
CREATE TABLE public."AdaptivePracticeQuizCohortSnapshot" (
    id uuid NOT NULL,
    "configId" uuid NOT NULL,
    "practiceQuizId" uuid NOT NULL,
    "releaseSize" integer NOT NULL,
    "releaseWatermark" timestamp(3) without time zone NOT NULL,
    "policyVersion" integer DEFAULT 1 NOT NULL,
    "attemptSelectionPolicy" public."AdaptiveAttemptSelectionPolicy" NOT NULL,
    aggregate jsonb NOT NULL,
    "invalidatedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "publicationId" uuid NOT NULL,
    "scaleVersionId" uuid NOT NULL,
    "measurementVersion" public."AdaptiveMeasurementVersion" NOT NULL,
    CONSTRAINT apqcs_aggregate_schema_check CHECK (((jsonb_typeof(aggregate) = 'object'::text) AND ((aggregate ->> 'schemaVersion'::text) = ANY (ARRAY['1'::text, '2'::text])))),
    CONSTRAINT apqcs_policy_version_check CHECK (("policyVersion" > 0)),
    CONSTRAINT apqcs_release_size_check CHECK (("releaseSize" >= 1))
);

-- TABLE: AdaptivePracticeQuizEmpiricalValidation
CREATE TABLE public."AdaptivePracticeQuizEmpiricalValidation" (
    id uuid NOT NULL,
    status public."AdaptiveEmpiricalValidationStatus" DEFAULT 'SUBMITTED'::public."AdaptiveEmpiricalValidationStatus" NOT NULL,
    "configId" uuid NOT NULL,
    "competenceTreeId" uuid NOT NULL,
    "scaleVersionId" uuid NOT NULL,
    "exportRequestId" uuid NOT NULL,
    "bankFingerprint" text NOT NULL,
    "configFingerprint" text NOT NULL,
    "measurementVersion" public."AdaptiveMeasurementVersion" NOT NULL,
    "estimatorImplementationVersion" text NOT NULL,
    "classificationPolicyVersion" integer NOT NULL,
    "calibrationPolicyVersion" integer NOT NULL,
    "validationProtocolVersion" text NOT NULL,
    "approvedProbabilityThreshold" double precision NOT NULL,
    "calibrationDatasetVersion" text NOT NULL,
    "calibrationDatasetChecksum" text NOT NULL,
    "holdoutDatasetVersion" text NOT NULL,
    "holdoutDatasetChecksum" text NOT NULL,
    "disjointSplitProofChecksum" text NOT NULL,
    "criterionArtifactChecksum" text NOT NULL,
    "aggregateMetrics" jsonb NOT NULL,
    "stratumMetrics" jsonb NOT NULL,
    "artifactChecksum" text NOT NULL,
    "artifactKey" text NOT NULL,
    "submittedById" uuid,
    "approvedById" uuid,
    "submittedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT apqev_evidence_check CHECK ((("classificationPolicyVersion" > 0) AND ("calibrationPolicyVersion" > 0) AND ((length("validationProtocolVersion") >= 1) AND (length("validationProtocolVersion") <= 160)) AND ("criterionArtifactChecksum" ~ '^[a-f0-9]{64}$'::text) AND (("approvedProbabilityThreshold")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND ("approvedProbabilityThreshold" >= (0.8)::double precision) AND ("approvedProbabilityThreshold" < (1)::double precision) AND ("calibrationDatasetVersion" <> "holdoutDatasetVersion") AND ("calibrationDatasetChecksum" <> "holdoutDatasetChecksum") AND (((status = 'SUBMITTED'::public."AdaptiveEmpiricalValidationStatus") AND ("approvedById" IS NULL) AND ("reviewedAt" IS NULL)) OR ((status = 'REJECTED'::public."AdaptiveEmpiricalValidationStatus") AND (("approvedById" IS NULL) = ("reviewedAt" IS NULL))) OR ((status = ANY (ARRAY['APPROVED'::public."AdaptiveEmpiricalValidationStatus", 'SUPERSEDED'::public."AdaptiveEmpiricalValidationStatus"])) AND ("approvedById" IS NOT NULL) AND ("reviewedAt" IS NOT NULL)))))
);

-- TABLE: AdaptivePracticeQuizEstimate
CREATE TABLE public."AdaptivePracticeQuizEstimate" (
    id integer NOT NULL,
    "nodeKind" public."AdaptiveEstimateNodeKind" NOT NULL,
    theta double precision,
    "standardError" double precision,
    "responseCount" integer NOT NULL,
    "stopReason" public."AdaptivePracticeQuizStopReason",
    "attemptId" uuid NOT NULL,
    "nodeId" integer,
    "levelId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "configId" uuid NOT NULL,
    "competenceTreeId" uuid NOT NULL,
    "resultStatus" public."AdaptiveResultStatus",
    "classificationProbability" double precision,
    "credibleLower" double precision,
    "credibleUpper" double precision,
    "bandProbabilities" jsonb,
    CONSTRAINT apqe_node_kind_node_check CHECK (((("nodeKind" = 'OVERALL'::public."AdaptiveEstimateNodeKind") AND ("nodeId" IS NULL)) OR (("nodeKind" = ANY (ARRAY['COMPETENCE'::public."AdaptiveEstimateNodeKind", 'SUBCOMPETENCE'::public."AdaptiveEstimateNodeKind"])) AND ("nodeId" IS NOT NULL)))),
    CONSTRAINT apqe_result_check CHECK (((("classificationProbability" IS NULL) OR (("classificationProbability" >= (0)::double precision) AND ("classificationProbability" <= (1)::double precision) AND (("classificationProbability")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])))) AND (("credibleLower" IS NULL) OR (("credibleLower")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))) AND (("credibleUpper" IS NULL) OR (("credibleUpper")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))) AND (("credibleLower" IS NULL) OR ("credibleUpper" IS NULL) OR ("credibleLower" <= "credibleUpper")))),
    CONSTRAINT apqe_runtime_values_check CHECK ((((theta IS NULL) OR ((theta >= ('-10'::integer)::double precision) AND (theta <= (10)::double precision))) AND (("standardError" IS NULL) OR ("standardError" > (0)::double precision)) AND ("responseCount" >= 0) AND (((theta IS NULL) AND ("standardError" IS NULL)) OR ((theta IS NOT NULL) AND ("standardError" IS NOT NULL)))))
);

-- SEQUENCE: AdaptivePracticeQuizEstimate_id_seq
CREATE SEQUENCE public."AdaptivePracticeQuizEstimate_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: AdaptivePracticeQuizEstimate_id_seq
ALTER SEQUENCE public."AdaptivePracticeQuizEstimate_id_seq" OWNED BY public."AdaptivePracticeQuizEstimate".id;

-- TABLE: AdaptivePracticeQuizItemExposure
CREATE TABLE public."AdaptivePracticeQuizItemExposure" (
    id integer NOT NULL,
    "publicationId" uuid NOT NULL,
    "poolItemId" integer NOT NULL,
    "servedCount" bigint DEFAULT 0 NOT NULL,
    "answeredCount" bigint DEFAULT 0 NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT apqie_counts_check CHECK ((("servedCount" >= 0) AND ("answeredCount" >= 0) AND ("answeredCount" <= "servedCount")))
);

-- COMMENT: TABLE "AdaptivePracticeQuizItemExposure"
COMMENT ON TABLE public."AdaptivePracticeQuizItemExposure" IS 'Mutable aggregate exposure counters without participant identity.';

-- SEQUENCE: AdaptivePracticeQuizItemExposure_id_seq
CREATE SEQUENCE public."AdaptivePracticeQuizItemExposure_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: AdaptivePracticeQuizItemExposure_id_seq
ALTER SEQUENCE public."AdaptivePracticeQuizItemExposure_id_seq" OWNED BY public."AdaptivePracticeQuizItemExposure".id;

-- TABLE: AdaptivePracticeQuizResponse
CREATE TABLE public."AdaptivePracticeQuizResponse" (
    id integer NOT NULL,
    "order" integer NOT NULL,
    response jsonb NOT NULL,
    "normalizedResponse" jsonb NOT NULL,
    correct boolean NOT NULL,
    "overallThetaBefore" double precision,
    "overallThetaAfter" double precision,
    "overallStandardErrorAfter" double precision,
    "elapsedSeconds" integer,
    "attemptId" uuid NOT NULL,
    "assignmentId" integer NOT NULL,
    "elementId" integer NOT NULL,
    "elementSnapshot" jsonb,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "poolItemId" integer,
    "configId" uuid NOT NULL,
    score double precision NOT NULL,
    "publicationId" uuid NOT NULL,
    "overallCredibleLowerAfter" double precision,
    "overallCredibleUpperAfter" double precision,
    "overallBandProbabilitiesAfter" jsonb,
    "administrationProbability" double precision,
    "collectionDesignVersion" text,
    "randomizationVersion" text,
    "randomDraw" bigint,
    "candidateSetHash" text,
    "itemRole" public."AdaptivePoolItemRole" DEFAULT 'SCORING'::public."AdaptivePoolItemRole" NOT NULL,
    "isCalibrationAnchor" boolean DEFAULT false NOT NULL,
    CONSTRAINT apqr_design_check CHECK (((("administrationProbability" IS NULL) OR (("administrationProbability" > (0)::double precision) AND ("administrationProbability" <= (1)::double precision) AND (("administrationProbability")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])))) AND (("randomDraw" IS NULL) OR (("randomDraw" >= 0) AND ("randomDraw" <= '4294967295'::bigint))) AND ("isCalibrationAnchor" = ("itemRole" = 'ANCHOR'::public."AdaptivePoolItemRole")) AND (("overallCredibleLowerAfter" IS NULL) OR (("overallCredibleLowerAfter")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))) AND (("overallCredibleUpperAfter" IS NULL) OR (("overallCredibleUpperAfter")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))) AND (("overallCredibleLowerAfter" IS NULL) OR ("overallCredibleUpperAfter" IS NULL) OR ("overallCredibleLowerAfter" <= "overallCredibleUpperAfter")))),
    CONSTRAINT apqr_element_snapshot_required_check CHECK (("elementSnapshot" IS NOT NULL)),
    CONSTRAINT apqr_pool_item_required_check CHECK (("poolItemId" IS NOT NULL)),
    CONSTRAINT apqr_runtime_values_check CHECK ((("order" > 0) AND ((score >= (0)::double precision) AND (score <= (1)::double precision)) AND (correct = (score = (1)::double precision)) AND (("overallThetaBefore" IS NULL) OR (("overallThetaBefore" >= ('-10'::integer)::double precision) AND ("overallThetaBefore" <= (10)::double precision))) AND (("overallThetaAfter" IS NULL) OR (("overallThetaAfter" >= ('-10'::integer)::double precision) AND ("overallThetaAfter" <= (10)::double precision))) AND (("overallStandardErrorAfter" IS NULL) OR ("overallStandardErrorAfter" > (0)::double precision)) AND (("elapsedSeconds" IS NULL) OR ("elapsedSeconds" >= 0))))
);

-- SEQUENCE: AdaptivePracticeQuizResponse_id_seq
CREATE SEQUENCE public."AdaptivePracticeQuizResponse_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: AdaptivePracticeQuizResponse_id_seq
ALTER SEQUENCE public."AdaptivePracticeQuizResponse_id_seq" OWNED BY public."AdaptivePracticeQuizResponse".id;

-- TABLE: CompetenceTree
CREATE TABLE public."CompetenceTree" (
    id uuid NOT NULL,
    name text NOT NULL,
    "displayName" text NOT NULL,
    description text,
    "isDeleted" boolean DEFAULT false NOT NULL,
    "maxDepth" integer DEFAULT 5 NOT NULL,
    "thetaMin" double precision DEFAULT '-3'::integer NOT NULL,
    "thetaMax" double precision DEFAULT 3 NOT NULL,
    "defaultDiscrimination" double precision DEFAULT 1.2 NOT NULL,
    "levelMappingRule" public."AdaptiveLevelMappingRule" DEFAULT 'NEAREST'::public."AdaptiveLevelMappingRule" NOT NULL,
    "ownerId" uuid NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "isArchived" boolean DEFAULT false NOT NULL,
    "defaultTotalQuestionCap" integer DEFAULT 50 NOT NULL,
    "defaultTimeLimitSeconds" integer,
    CONSTRAINT ct_default_time_limit_seconds_check CHECK ((("defaultTimeLimitSeconds" IS NULL) OR ("defaultTimeLimitSeconds" > 0))),
    CONSTRAINT ct_default_total_question_cap_check CHECK ((("defaultTotalQuestionCap" >= 2) AND ("defaultTotalQuestionCap" <= 1000)))
);

-- TABLE: CompetenceTreeCourse
CREATE TABLE public."CompetenceTreeCourse" (
    id integer NOT NULL,
    "treeId" uuid NOT NULL,
    "courseId" uuid NOT NULL,
    "linkedById" uuid,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- SEQUENCE: CompetenceTreeCourse_id_seq
CREATE SEQUENCE public."CompetenceTreeCourse_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: CompetenceTreeCourse_id_seq
ALTER SEQUENCE public."CompetenceTreeCourse_id_seq" OWNED BY public."CompetenceTreeCourse".id;

-- TABLE: CompetenceTreeElementAssignment
CREATE TABLE public."CompetenceTreeElementAssignment" (
    id integer NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    discrimination double precision,
    "enablePercentInput" boolean DEFAULT false NOT NULL,
    "treeId" uuid NOT NULL,
    "elementId" integer NOT NULL,
    "leafNodeId" integer NOT NULL,
    "levelId" integer NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

-- SEQUENCE: CompetenceTreeElementAssignment_id_seq
CREATE SEQUENCE public."CompetenceTreeElementAssignment_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: CompetenceTreeElementAssignment_id_seq
ALTER SEQUENCE public."CompetenceTreeElementAssignment_id_seq" OWNED BY public."CompetenceTreeElementAssignment".id;

-- TABLE: CompetenceTreeLeafLevelCoverage
CREATE TABLE public."CompetenceTreeLeafLevelCoverage" (
    id integer NOT NULL,
    "targetItemCount" integer DEFAULT 5 NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    "treeId" uuid NOT NULL,
    "leafNodeId" integer NOT NULL,
    "levelId" integer NOT NULL
);

-- SEQUENCE: CompetenceTreeLeafLevelCoverage_id_seq
CREATE SEQUENCE public."CompetenceTreeLeafLevelCoverage_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: CompetenceTreeLeafLevelCoverage_id_seq
ALTER SEQUENCE public."CompetenceTreeLeafLevelCoverage_id_seq" OWNED BY public."CompetenceTreeLeafLevelCoverage".id;

-- TABLE: CompetenceTreeLevel
CREATE TABLE public."CompetenceTreeLevel" (
    id integer NOT NULL,
    label text NOT NULL,
    "order" integer NOT NULL,
    "treeId" uuid NOT NULL
);

-- SEQUENCE: CompetenceTreeLevel_id_seq
CREATE SEQUENCE public."CompetenceTreeLevel_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: CompetenceTreeLevel_id_seq
ALTER SEQUENCE public."CompetenceTreeLevel_id_seq" OWNED BY public."CompetenceTreeLevel".id;

-- TABLE: CompetenceTreeNode
CREATE TABLE public."CompetenceTreeNode" (
    id integer NOT NULL,
    kind public."AdaptiveNodeKind" NOT NULL,
    name text NOT NULL,
    description text,
    "order" integer NOT NULL,
    depth integer NOT NULL,
    weight double precision DEFAULT 1 NOT NULL,
    "treeId" uuid NOT NULL,
    "parentId" integer,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

-- SEQUENCE: CompetenceTreeNode_id_seq
CREATE SEQUENCE public."CompetenceTreeNode_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: CompetenceTreeNode_id_seq
ALTER SEQUENCE public."CompetenceTreeNode_id_seq" OWNED BY public."CompetenceTreeNode".id;

-- TABLE: CompetenceTreeScaleApproval
CREATE TABLE public."CompetenceTreeScaleApproval" (
    id uuid NOT NULL,
    "treeId" uuid NOT NULL,
    "scaleVersionId" uuid NOT NULL,
    method text NOT NULL,
    "methodVersion" text NOT NULL,
    "panelSize" integer NOT NULL,
    "standardSettingDate" timestamp(3) without time zone NOT NULL,
    "cutRationale" jsonb NOT NULL,
    "artifactChecksum" text NOT NULL,
    "artifactKey" text NOT NULL,
    decision public."AdaptiveScaleVersionStatus",
    "submittedById" uuid,
    "reviewerId" uuid,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT ctsa_evidence_check CHECK ((("panelSize" > 0) AND ((decision IS NULL) OR (decision = ANY (ARRAY['APPROVED'::public."AdaptiveScaleVersionStatus", 'REJECTED'::public."AdaptiveScaleVersionStatus"]))) AND ((decision IS NULL) = ("reviewerId" IS NULL)) AND ((decision IS NULL) = ("reviewedAt" IS NULL)) AND (length(method) > 0) AND (length("methodVersion") > 0) AND (length("artifactChecksum") > 0) AND (length("artifactKey") > 0)))
);

-- TABLE: CompetenceTreeScaleLevel
CREATE TABLE public."CompetenceTreeScaleLevel" (
    id integer NOT NULL,
    "order" integer NOT NULL,
    label text NOT NULL,
    "lowerBound" double precision,
    "itemDifficultyPrior" double precision NOT NULL,
    "treeId" uuid NOT NULL,
    "scaleVersionId" uuid NOT NULL,
    "sourceLevelId" integer,
    CONSTRAINT ctsl_numeric_check CHECK ((("order" >= 0) AND (("lowerBound" IS NULL) OR (("lowerBound")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))) AND (("itemDifficultyPrior")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text]))))
);

-- SEQUENCE: CompetenceTreeScaleLevel_id_seq
CREATE SEQUENCE public."CompetenceTreeScaleLevel_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: CompetenceTreeScaleLevel_id_seq
ALTER SEQUENCE public."CompetenceTreeScaleLevel_id_seq" OWNED BY public."CompetenceTreeScaleLevel".id;

-- TABLE: CompetenceTreeScaleLink
CREATE TABLE public."CompetenceTreeScaleLink" (
    id uuid NOT NULL,
    status public."AdaptiveScaleLinkStatus" DEFAULT 'DRAFT'::public."AdaptiveScaleLinkStatus" NOT NULL,
    "treeId" uuid NOT NULL,
    "fromScaleVersionId" uuid NOT NULL,
    "toScaleVersionId" uuid NOT NULL,
    method text NOT NULL,
    "implementationVersion" text NOT NULL,
    "fitMetrics" jsonb NOT NULL,
    "uncertaintyMetrics" jsonb NOT NULL,
    "artifactChecksum" text NOT NULL,
    "artifactKey" text NOT NULL,
    "createdById" uuid,
    "reviewedById" uuid,
    "submittedForReviewAt" timestamp(3) without time zone,
    "reviewedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT ctslk_versions_check CHECK ((("fromScaleVersionId" <> "toScaleVersionId") AND (("reviewedById" IS NULL) = ("reviewedAt" IS NULL))))
);

-- TABLE: CompetenceTreeScaleLinkAnchor
CREATE TABLE public."CompetenceTreeScaleLinkAnchor" (
    id integer NOT NULL,
    "scaleLinkId" uuid NOT NULL,
    "fromCalibrationId" uuid NOT NULL,
    "toCalibrationId" uuid NOT NULL,
    "order" integer NOT NULL,
    CONSTRAINT ctsla_order_check CHECK (("order" >= 0))
);

-- SEQUENCE: CompetenceTreeScaleLinkAnchor_id_seq
CREATE SEQUENCE public."CompetenceTreeScaleLinkAnchor_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: CompetenceTreeScaleLinkAnchor_id_seq
ALTER SEQUENCE public."CompetenceTreeScaleLinkAnchor_id_seq" OWNED BY public."CompetenceTreeScaleLinkAnchor".id;

-- TABLE: CompetenceTreeScaleVersion
CREATE TABLE public."CompetenceTreeScaleVersion" (
    id uuid NOT NULL,
    version integer NOT NULL,
    status public."AdaptiveScaleVersionStatus" DEFAULT 'DRAFT'::public."AdaptiveScaleVersionStatus" NOT NULL,
    "priorMean" double precision DEFAULT 0 NOT NULL,
    "priorStandardDeviation" double precision DEFAULT 1 NOT NULL,
    "gridMin" double precision DEFAULT '-6'::integer NOT NULL,
    "gridMax" double precision DEFAULT 6 NOT NULL,
    "gridStep" double precision DEFAULT 0.1 NOT NULL,
    "classificationPolicyVersion" integer DEFAULT 1 NOT NULL,
    "treeId" uuid NOT NULL,
    "supersedesVersionId" uuid,
    "createdById" uuid,
    "submittedForReviewAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    CONSTRAINT ctsv_numeric_check CHECK (((version > 0) AND ("classificationPolicyVersion" > 0) AND (("priorMean")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND (("priorStandardDeviation")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND ("priorStandardDeviation" > (0)::double precision) AND (("gridMin")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND (("gridMax")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND (("gridStep")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND ("gridMin" < "gridMax") AND ("gridStep" > (0)::double precision)))
);

-- COMMENT: TABLE "CompetenceTreeScaleVersion"
COMMENT ON TABLE public."CompetenceTreeScaleVersion" IS 'Versioned latent scale; activation requires independent standard-setting evidence.';

-- COMMENT: COLUMN "Element"."creationRequestId"
COMMENT ON COLUMN public."Element"."creationRequestId" IS 'Durable idempotency token for atomic first-save element creation and assignment.';

-- COMMENT: COLUMN "Element"."creationRequestFingerprint"
COMMENT ON COLUMN public."Element"."creationRequestFingerprint" IS 'SHA-256 fingerprint of the immutable first-save element and assignment request.';

-- TABLE: PracticeQuizAdaptiveConfig
CREATE TABLE public."PracticeQuizAdaptiveConfig" (
    id uuid NOT NULL,
    "practiceQuizId" uuid NOT NULL,
    "competenceTreeId" uuid NOT NULL,
    "totalQuestionCap" integer DEFAULT 50 NOT NULL,
    "perLeafQuestionCap" integer,
    "minQuestionsPerLeaf" integer DEFAULT 2 NOT NULL,
    "classificationZ" double precision DEFAULT 1.28 NOT NULL,
    "topInformationRatio" double precision DEFAULT 0.8 NOT NULL,
    "defaultDiscrimination" double precision DEFAULT 1.2 NOT NULL,
    "levelMappingRule" public."AdaptiveLevelMappingRule" DEFAULT 'NEAREST'::public."AdaptiveLevelMappingRule" NOT NULL,
    "showTimer" boolean DEFAULT true NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    preset public."AdaptivePracticeQuizPreset" DEFAULT 'DIAGNOSTIC'::public."AdaptivePracticeQuizPreset" NOT NULL,
    "attemptSelectionPolicy" public."AdaptiveAttemptSelectionPolicy" DEFAULT 'LATEST_COMPLETED'::public."AdaptiveAttemptSelectionPolicy" NOT NULL,
    "poolPublishedAt" timestamp(3) without time zone,
    "measurementVersion" public."AdaptiveMeasurementVersion" DEFAULT 'IRT_V1'::public."AdaptiveMeasurementVersion" NOT NULL,
    "calibrationPolicyVersion" integer,
    "scaleVersionId" uuid,
    "timeLimitSeconds" integer,
    CONSTRAINT pqac_numeric_bounds_check CHECK (((("totalQuestionCap" >= 1) AND ("totalQuestionCap" <= 1000)) AND (("perLeafQuestionCap" IS NULL) OR (("perLeafQuestionCap" >= 1) AND ("perLeafQuestionCap" <= "totalQuestionCap"))) AND (("minQuestionsPerLeaf" >= 1) AND ("minQuestionsPerLeaf" <= "totalQuestionCap")) AND ("classificationZ" > (0)::double precision) AND ("classificationZ" <= (5)::double precision) AND ("topInformationRatio" > (0)::double precision) AND ("topInformationRatio" <= (1)::double precision) AND ("defaultDiscrimination" > (0)::double precision) AND ("defaultDiscrimination" <= (10)::double precision))),
    CONSTRAINT pqac_preset_semantics_check CHECK (((("measurementVersion" = 'IRT_V1'::public."AdaptiveMeasurementVersion") AND (((preset = 'PLACEMENT'::public."AdaptivePracticeQuizPreset") AND ("levelMappingRule" = 'MASTERY'::public."AdaptiveLevelMappingRule") AND ("attemptSelectionPolicy" = 'FIRST_COMPLETED'::public."AdaptiveAttemptSelectionPolicy") AND ("topInformationRatio" = (0.8)::double precision) AND ("defaultDiscrimination" = (1.2)::double precision)) OR ((preset = 'DIAGNOSTIC'::public."AdaptivePracticeQuizPreset") AND ("levelMappingRule" = 'NEAREST'::public."AdaptiveLevelMappingRule") AND ("attemptSelectionPolicy" = 'LATEST_COMPLETED'::public."AdaptiveAttemptSelectionPolicy") AND ("topInformationRatio" = (0.8)::double precision) AND ("defaultDiscrimination" = (1.2)::double precision)) OR (preset = 'RESEARCH'::public."AdaptivePracticeQuizPreset"))) OR (("measurementVersion" = 'IRT_V2_EAP_GRID_1'::public."AdaptiveMeasurementVersion") AND (((preset = 'PLACEMENT'::public."AdaptivePracticeQuizPreset") AND ("levelMappingRule" = 'NEAREST'::public."AdaptiveLevelMappingRule") AND ("attemptSelectionPolicy" = 'LATEST_COMPLETED'::public."AdaptiveAttemptSelectionPolicy") AND ("topInformationRatio" = (0.8)::double precision) AND ("defaultDiscrimination" = (1.2)::double precision)) OR ((preset = 'DIAGNOSTIC'::public."AdaptivePracticeQuizPreset") AND ("levelMappingRule" = 'NEAREST'::public."AdaptiveLevelMappingRule") AND ("attemptSelectionPolicy" = 'LATEST_COMPLETED'::public."AdaptiveAttemptSelectionPolicy") AND ("topInformationRatio" = (0.8)::double precision) AND ("defaultDiscrimination" = (1.2)::double precision)) OR (preset = 'RESEARCH'::public."AdaptivePracticeQuizPreset"))))),
    CONSTRAINT pqac_time_limit_seconds_check CHECK ((("timeLimitSeconds" IS NULL) OR ("timeLimitSeconds" > 0)))
);

-- TABLE: PracticeQuizAdaptiveElementOverride
CREATE TABLE public."PracticeQuizAdaptiveElementOverride" (
    id integer NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    discrimination double precision,
    "configId" uuid NOT NULL,
    "assignmentId" integer NOT NULL,
    "competenceTreeId" uuid NOT NULL,
    CONSTRAINT pqae_discrimination_check CHECK (((discrimination IS NULL) OR ((discrimination > (0)::double precision) AND (discrimination <= (10)::double precision))))
);

-- SEQUENCE: PracticeQuizAdaptiveElementOverride_id_seq
CREATE SEQUENCE public."PracticeQuizAdaptiveElementOverride_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: PracticeQuizAdaptiveElementOverride_id_seq
ALTER SEQUENCE public."PracticeQuizAdaptiveElementOverride_id_seq" OWNED BY public."PracticeQuizAdaptiveElementOverride".id;

-- TABLE: PracticeQuizAdaptiveNodeOverride
CREATE TABLE public."PracticeQuizAdaptiveNodeOverride" (
    id integer NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    weight double precision,
    "questionCap" integer,
    "configId" uuid NOT NULL,
    "nodeId" integer NOT NULL,
    "competenceTreeId" uuid NOT NULL,
    CONSTRAINT pqan_values_check CHECK ((((weight IS NULL) OR (weight >= (0)::double precision)) AND (("questionCap" IS NULL) OR (("questionCap" >= 1) AND ("questionCap" <= 1000)))))
);

-- SEQUENCE: PracticeQuizAdaptiveNodeOverride_id_seq
CREATE SEQUENCE public."PracticeQuizAdaptiveNodeOverride_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: PracticeQuizAdaptiveNodeOverride_id_seq
ALTER SEQUENCE public."PracticeQuizAdaptiveNodeOverride_id_seq" OWNED BY public."PracticeQuizAdaptiveNodeOverride".id;

-- TABLE: PracticeQuizAdaptivePoolItem
CREATE TABLE public."PracticeQuizAdaptivePoolItem" (
    id integer NOT NULL,
    "configId" uuid NOT NULL,
    "competenceTreeId" uuid NOT NULL,
    "sourceAssignmentId" integer NOT NULL,
    "elementId" integer NOT NULL,
    "elementVersion" integer NOT NULL,
    "elementType" public."ElementType" NOT NULL,
    "elementName" text NOT NULL,
    "elementData" jsonb NOT NULL,
    "leafNodeId" integer NOT NULL,
    "nodePath" integer[] NOT NULL,
    "nodeNamePath" text[] NOT NULL,
    "levelId" integer NOT NULL,
    "levelLabel" text NOT NULL,
    "levelOrder" integer NOT NULL,
    discrimination double precision NOT NULL,
    difficulty double precision NOT NULL,
    guessing double precision NOT NULL,
    "enablePercentInput" boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "publicationId" uuid NOT NULL,
    "scaleVersionId" uuid NOT NULL,
    "calibrationId" uuid NOT NULL,
    "measurementVersion" public."AdaptiveMeasurementVersion" NOT NULL,
    "calibrationVersion" integer NOT NULL,
    "calibrationStatus" public."AdaptiveItemCalibrationStatus" NOT NULL,
    "itemModel" public."AdaptiveItemModel" NOT NULL,
    "modelImplementationVersion" text NOT NULL,
    role public."AdaptivePoolItemRole" DEFAULT 'SCORING'::public."AdaptivePoolItemRole" NOT NULL,
    "contributesToEstimate" boolean DEFAULT true NOT NULL,
    "additionalLeafNodeIds" integer[] DEFAULT ARRAY[]::integer[] NOT NULL,
    CONSTRAINT pqapi_snapshot_check CHECK ((("elementVersion" > 0) AND ("calibrationVersion" > 0) AND ((discrimination)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND ((difficulty)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND ((guessing)::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND (discrimination > (0)::double precision) AND (guessing >= (0)::double precision) AND (guessing < (1)::double precision) AND (((role = 'FIELD_TEST'::public."AdaptivePoolItemRole") AND (NOT "contributesToEstimate")) OR ((role = ANY (ARRAY['SCORING'::public."AdaptivePoolItemRole", 'ANCHOR'::public."AdaptivePoolItemRole"])) AND "contributesToEstimate")))),
    CONSTRAINT pqapi_values_check CHECK ((("elementVersion" > 0) AND ("levelOrder" >= 0) AND (discrimination > (0)::double precision) AND (discrimination <= (10)::double precision) AND ((difficulty >= ('-10'::integer)::double precision) AND (difficulty <= (10)::double precision)) AND (guessing >= (0)::double precision) AND (guessing < (1)::double precision) AND (cardinality("nodePath") > 0) AND (cardinality("nodePath") = cardinality("nodeNamePath"))))
);

-- SEQUENCE: PracticeQuizAdaptivePoolItem_id_seq
CREATE SEQUENCE public."PracticeQuizAdaptivePoolItem_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- SEQUENCE OWNED BY: PracticeQuizAdaptivePoolItem_id_seq
ALTER SEQUENCE public."PracticeQuizAdaptivePoolItem_id_seq" OWNED BY public."PracticeQuizAdaptivePoolItem".id;

-- TABLE: PracticeQuizAdaptivePublication
CREATE TABLE public."PracticeQuizAdaptivePublication" (
    id uuid NOT NULL,
    version integer NOT NULL,
    "configId" uuid NOT NULL,
    "competenceTreeId" uuid NOT NULL,
    "scaleVersionId" uuid NOT NULL,
    "measurementVersion" public."AdaptiveMeasurementVersion" NOT NULL,
    preset public."AdaptivePracticeQuizPreset" NOT NULL,
    "estimatorImplementationVersion" text NOT NULL,
    "classificationPolicyVersion" integer NOT NULL,
    "calibrationPolicyVersion" integer NOT NULL,
    "cutScoreSnapshot" jsonb NOT NULL,
    "priorMean" double precision NOT NULL,
    "priorStandardDeviation" double precision NOT NULL,
    "gridMin" double precision NOT NULL,
    "gridMax" double precision NOT NULL,
    "gridStep" double precision NOT NULL,
    "classificationProbabilityThreshold" double precision,
    "hierarchicalWeightSnapshot" jsonb NOT NULL,
    "evidenceMinimumSnapshot" jsonb NOT NULL,
    "totalQuestionCap" integer NOT NULL,
    "showTimer" boolean NOT NULL,
    "questionCapSnapshot" jsonb NOT NULL,
    "candidateSetPolicyVersion" text NOT NULL,
    "randomizationPolicyVersion" text NOT NULL,
    "exposureCeiling" double precision NOT NULL,
    "overlapPolicyVersion" text NOT NULL,
    "retakePolicy" public."AdaptiveAttemptSelectionPolicy" NOT NULL,
    "retakeCooldownDays" integer NOT NULL,
    "researchAllocationPolicy" jsonb,
    "stoppingPolicyVersion" text NOT NULL,
    "rolloutPolicyVersion" integer NOT NULL,
    "empiricalValidationId" uuid,
    "publishedById" uuid,
    "publishedAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "sealedAt" timestamp(3) without time zone,
    "supersededAt" timestamp(3) without time zone,
    "unpublishedAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "timeLimitSeconds" integer,
    CONSTRAINT pqap_focused_root_placement_leaf_caps_check CHECK ((("stoppingPolicyVersion" <> 'IRT_V2_FOCUSED_ROOT_BALANCED_PLACEMENT_1'::text) OR (NOT jsonb_path_exists("questionCapSnapshot", '$."leaf".*?(@ != null)'::jsonpath)))),
    CONSTRAINT pqap_lifecycle_timestamps_check CHECK (((("sealedAt" IS NULL) OR ("sealedAt" >= "publishedAt")) AND (("supersededAt" IS NULL) OR (("sealedAt" IS NOT NULL) AND ("supersededAt" >= "sealedAt"))) AND (("unpublishedAt" IS NULL) OR (("sealedAt" IS NOT NULL) AND ("unpublishedAt" >= "sealedAt"))))),
    CONSTRAINT pqap_placement_stopping_policy_check CHECK (((((("measurementVersion" = 'IRT_V2_EAP_GRID_1'::public."AdaptiveMeasurementVersion") AND (preset = 'PLACEMENT'::public."AdaptivePracticeQuizPreset")) = ("stoppingPolicyVersion" = ANY (ARRAY['IRT_V2_OVERALL_PLACEMENT_PILOT_1'::text, 'IRT_V2_ROOT_BALANCED_PLACEMENT_1'::text, 'IRT_V2_FOCUSED_ROOT_BALANCED_PLACEMENT_1'::text]))) AND (("stoppingPolicyVersion" <> 'IRT_V2_OVERALL_PLACEMENT_PILOT_1'::text) OR (("researchAllocationPolicy" = 'null'::jsonb) AND ("classificationProbabilityThreshold" = (0.8)::double precision) AND ("totalQuestionCap" <= 50) AND ((("evidenceMinimumSnapshot" ->> 'minimumResponsesPerLeaf'::text))::integer >= 4) AND ((("evidenceMinimumSnapshot" ->> 'minimumResponsesPerRoot'::text))::integer >= 4) AND (("evidenceMinimumSnapshot" ->> 'levelMappingRule'::text) = 'NEAREST'::text) AND ("retakePolicy" = 'LATEST_COMPLETED'::public."AdaptiveAttemptSelectionPolicy"))) AND (("stoppingPolicyVersion" <> 'IRT_V2_ROOT_BALANCED_PLACEMENT_1'::text) OR (("researchAllocationPolicy" = 'null'::jsonb) AND ("classificationProbabilityThreshold" = (0.8)::double precision) AND ("totalQuestionCap" <= 60) AND ((("evidenceMinimumSnapshot" ->> 'minimumResponsesPerRoot'::text))::integer >= 4) AND (("evidenceMinimumSnapshot" ->> 'levelMappingRule'::text) = 'NEAREST'::text) AND ("retakePolicy" = 'LATEST_COMPLETED'::public."AdaptiveAttemptSelectionPolicy"))) AND (("stoppingPolicyVersion" <> 'IRT_V2_FOCUSED_ROOT_BALANCED_PLACEMENT_1'::text) OR (("researchAllocationPolicy" = 'null'::jsonb) AND ("classificationProbabilityThreshold" = (0.8)::double precision) AND ((("evidenceMinimumSnapshot" ->> 'minimumResponsesPerRoot'::text))::integer >= 4) AND (("evidenceMinimumSnapshot" ->> 'levelMappingRule'::text) = 'NEAREST'::text) AND ("retakePolicy" = 'LATEST_COMPLETED'::public."AdaptiveAttemptSelectionPolicy")))) IS TRUE)),
    CONSTRAINT pqap_policy_check CHECK (((version > 0) AND ("classificationPolicyVersion" > 0) AND ("calibrationPolicyVersion" > 0) AND ("rolloutPolicyVersion" > 0) AND (("priorMean")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND (("priorStandardDeviation")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND ("priorStandardDeviation" > (0)::double precision) AND (("gridMin")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND (("gridMax")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND (("gridStep")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND ("gridMin" < "gridMax") AND ("gridStep" > (0)::double precision) AND ("totalQuestionCap" > 0) AND ("retakeCooldownDays" >= 0) AND (("exposureCeiling")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])) AND ("exposureCeiling" > (0)::double precision) AND ("exposureCeiling" <= (1)::double precision) AND ((("measurementVersion" = 'IRT_V1'::public."AdaptiveMeasurementVersion") AND ("classificationProbabilityThreshold" IS NULL)) OR (("measurementVersion" = 'IRT_V2_EAP_GRID_1'::public."AdaptiveMeasurementVersion") AND ("classificationProbabilityThreshold" >= (0.8)::double precision) AND ("classificationProbabilityThreshold" < (1)::double precision) AND (("classificationProbabilityThreshold")::text <> ALL (ARRAY['NaN'::text, 'Infinity'::text, '-Infinity'::text])))))),
    CONSTRAINT pqap_root_placement_leaf_caps_check CHECK ((("stoppingPolicyVersion" <> 'IRT_V2_ROOT_BALANCED_PLACEMENT_1'::text) OR (NOT jsonb_path_exists("questionCapSnapshot", '$."leaf".*?(@ != null)'::jsonpath)))),
    CONSTRAINT pqap_time_limit_seconds_check CHECK ((("timeLimitSeconds" IS NULL) OR ("timeLimitSeconds" > 0)))
);

-- COMMENT: TABLE "PracticeQuizAdaptivePublication"
COMMENT ON TABLE public."PracticeQuizAdaptivePublication" IS 'Immutable estimator, policy, scale, and cut-score snapshot for one materialized adaptive pool.';

-- TABLE: _AdditionalAssignmentLeaves
CREATE TABLE public."_AdditionalAssignmentLeaves" (
    "A" integer NOT NULL,
    "B" integer NOT NULL
);

-- DEFAULT: AdaptiveAssessmentCompetence id
ALTER TABLE ONLY public."AdaptiveAssessmentCompetence" ALTER COLUMN id SET DEFAULT nextval('public."AdaptiveAssessmentCompetence_id_seq"'::regclass);

-- DEFAULT: AdaptiveAssessmentElement id
ALTER TABLE ONLY public."AdaptiveAssessmentElement" ALTER COLUMN id SET DEFAULT nextval('public."AdaptiveAssessmentElement_id_seq"'::regclass);

-- DEFAULT: AdaptiveAssessmentLevel id
ALTER TABLE ONLY public."AdaptiveAssessmentLevel" ALTER COLUMN id SET DEFAULT nextval('public."AdaptiveAssessmentLevel_id_seq"'::regclass);

-- DEFAULT: AdaptiveAssessmentResponse id
ALTER TABLE ONLY public."AdaptiveAssessmentResponse" ALTER COLUMN id SET DEFAULT nextval('public."AdaptiveAssessmentResponse_id_seq"'::regclass);

-- DEFAULT: AdaptiveAssessmentResultMessage id
ALTER TABLE ONLY public."AdaptiveAssessmentResultMessage" ALTER COLUMN id SET DEFAULT nextval('public."AdaptiveAssessmentResultMessage_id_seq"'::regclass);

-- DEFAULT: AdaptiveAssessmentSubCompetence id
ALTER TABLE ONLY public."AdaptiveAssessmentSubCompetence" ALTER COLUMN id SET DEFAULT nextval('public."AdaptiveAssessmentSubCompetence_id_seq"'::regclass);

-- DEFAULT: AdaptivePracticeQuizEstimate id
ALTER TABLE ONLY public."AdaptivePracticeQuizEstimate" ALTER COLUMN id SET DEFAULT nextval('public."AdaptivePracticeQuizEstimate_id_seq"'::regclass);

-- DEFAULT: AdaptivePracticeQuizItemExposure id
ALTER TABLE ONLY public."AdaptivePracticeQuizItemExposure" ALTER COLUMN id SET DEFAULT nextval('public."AdaptivePracticeQuizItemExposure_id_seq"'::regclass);

-- DEFAULT: AdaptivePracticeQuizResponse id
ALTER TABLE ONLY public."AdaptivePracticeQuizResponse" ALTER COLUMN id SET DEFAULT nextval('public."AdaptivePracticeQuizResponse_id_seq"'::regclass);

-- DEFAULT: CompetenceTreeCourse id
ALTER TABLE ONLY public."CompetenceTreeCourse" ALTER COLUMN id SET DEFAULT nextval('public."CompetenceTreeCourse_id_seq"'::regclass);

-- DEFAULT: CompetenceTreeElementAssignment id
ALTER TABLE ONLY public."CompetenceTreeElementAssignment" ALTER COLUMN id SET DEFAULT nextval('public."CompetenceTreeElementAssignment_id_seq"'::regclass);

-- DEFAULT: CompetenceTreeLeafLevelCoverage id
ALTER TABLE ONLY public."CompetenceTreeLeafLevelCoverage" ALTER COLUMN id SET DEFAULT nextval('public."CompetenceTreeLeafLevelCoverage_id_seq"'::regclass);

-- DEFAULT: CompetenceTreeLevel id
ALTER TABLE ONLY public."CompetenceTreeLevel" ALTER COLUMN id SET DEFAULT nextval('public."CompetenceTreeLevel_id_seq"'::regclass);

-- DEFAULT: CompetenceTreeNode id
ALTER TABLE ONLY public."CompetenceTreeNode" ALTER COLUMN id SET DEFAULT nextval('public."CompetenceTreeNode_id_seq"'::regclass);

-- DEFAULT: CompetenceTreeScaleLevel id
ALTER TABLE ONLY public."CompetenceTreeScaleLevel" ALTER COLUMN id SET DEFAULT nextval('public."CompetenceTreeScaleLevel_id_seq"'::regclass);

-- DEFAULT: CompetenceTreeScaleLinkAnchor id
ALTER TABLE ONLY public."CompetenceTreeScaleLinkAnchor" ALTER COLUMN id SET DEFAULT nextval('public."CompetenceTreeScaleLinkAnchor_id_seq"'::regclass);

-- DEFAULT: PracticeQuizAdaptiveElementOverride id
ALTER TABLE ONLY public."PracticeQuizAdaptiveElementOverride" ALTER COLUMN id SET DEFAULT nextval('public."PracticeQuizAdaptiveElementOverride_id_seq"'::regclass);

-- DEFAULT: PracticeQuizAdaptiveNodeOverride id
ALTER TABLE ONLY public."PracticeQuizAdaptiveNodeOverride" ALTER COLUMN id SET DEFAULT nextval('public."PracticeQuizAdaptiveNodeOverride_id_seq"'::regclass);

-- DEFAULT: PracticeQuizAdaptivePoolItem id
ALTER TABLE ONLY public."PracticeQuizAdaptivePoolItem" ALTER COLUMN id SET DEFAULT nextval('public."PracticeQuizAdaptivePoolItem_id_seq"'::regclass);

-- CONSTRAINT: AdaptiveAssessmentAttempt AdaptiveAssessmentAttempt_pkey
ALTER TABLE ONLY public."AdaptiveAssessmentAttempt"
    ADD CONSTRAINT "AdaptiveAssessmentAttempt_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptiveAssessmentCompetence AdaptiveAssessmentCompetence_pkey
ALTER TABLE ONLY public."AdaptiveAssessmentCompetence"
    ADD CONSTRAINT "AdaptiveAssessmentCompetence_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptiveAssessmentElement AdaptiveAssessmentElement_pkey
ALTER TABLE ONLY public."AdaptiveAssessmentElement"
    ADD CONSTRAINT "AdaptiveAssessmentElement_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptiveAssessmentLevel AdaptiveAssessmentLevel_pkey
ALTER TABLE ONLY public."AdaptiveAssessmentLevel"
    ADD CONSTRAINT "AdaptiveAssessmentLevel_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptiveAssessmentResponse AdaptiveAssessmentResponse_pkey
ALTER TABLE ONLY public."AdaptiveAssessmentResponse"
    ADD CONSTRAINT "AdaptiveAssessmentResponse_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptiveAssessmentResultMessage AdaptiveAssessmentResultMessage_pkey
ALTER TABLE ONLY public."AdaptiveAssessmentResultMessage"
    ADD CONSTRAINT "AdaptiveAssessmentResultMessage_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptiveAssessmentSubCompetence AdaptiveAssessmentSubCompetence_pkey
ALTER TABLE ONLY public."AdaptiveAssessmentSubCompetence"
    ADD CONSTRAINT "AdaptiveAssessmentSubCompetence_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptiveAssessment AdaptiveAssessment_pkey
ALTER TABLE ONLY public."AdaptiveAssessment"
    ADD CONSTRAINT "AdaptiveAssessment_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptiveCalibrationExportRequest AdaptiveCalibrationExportRequest_pkey
ALTER TABLE ONLY public."AdaptiveCalibrationExportRequest"
    ADD CONSTRAINT "AdaptiveCalibrationExportRequest_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptiveItemCalibration AdaptiveItemCalibration_pkey
ALTER TABLE ONLY public."AdaptiveItemCalibration"
    ADD CONSTRAINT "AdaptiveItemCalibration_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptivePracticeQuizAttempt AdaptivePracticeQuizAttempt_pkey
ALTER TABLE ONLY public."AdaptivePracticeQuizAttempt"
    ADD CONSTRAINT "AdaptivePracticeQuizAttempt_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptivePracticeQuizCohortSnapshot AdaptivePracticeQuizCohortSnapshot_pkey
ALTER TABLE ONLY public."AdaptivePracticeQuizCohortSnapshot"
    ADD CONSTRAINT "AdaptivePracticeQuizCohortSnapshot_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptivePracticeQuizEmpiricalValidation AdaptivePracticeQuizEmpiricalValidation_pkey
ALTER TABLE ONLY public."AdaptivePracticeQuizEmpiricalValidation"
    ADD CONSTRAINT "AdaptivePracticeQuizEmpiricalValidation_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptivePracticeQuizEstimate AdaptivePracticeQuizEstimate_pkey
ALTER TABLE ONLY public."AdaptivePracticeQuizEstimate"
    ADD CONSTRAINT "AdaptivePracticeQuizEstimate_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptivePracticeQuizItemExposure AdaptivePracticeQuizItemExposure_pkey
ALTER TABLE ONLY public."AdaptivePracticeQuizItemExposure"
    ADD CONSTRAINT "AdaptivePracticeQuizItemExposure_pkey" PRIMARY KEY (id);

-- CONSTRAINT: AdaptivePracticeQuizResponse AdaptivePracticeQuizResponse_pkey
ALTER TABLE ONLY public."AdaptivePracticeQuizResponse"
    ADD CONSTRAINT "AdaptivePracticeQuizResponse_pkey" PRIMARY KEY (id);

-- CONSTRAINT: CompetenceTreeCourse CompetenceTreeCourse_pkey
ALTER TABLE ONLY public."CompetenceTreeCourse"
    ADD CONSTRAINT "CompetenceTreeCourse_pkey" PRIMARY KEY (id);

-- CONSTRAINT: CompetenceTreeElementAssignment CompetenceTreeElementAssignment_pkey
ALTER TABLE ONLY public."CompetenceTreeElementAssignment"
    ADD CONSTRAINT "CompetenceTreeElementAssignment_pkey" PRIMARY KEY (id);

-- CONSTRAINT: CompetenceTreeLeafLevelCoverage CompetenceTreeLeafLevelCoverage_pkey
ALTER TABLE ONLY public."CompetenceTreeLeafLevelCoverage"
    ADD CONSTRAINT "CompetenceTreeLeafLevelCoverage_pkey" PRIMARY KEY (id);

-- CONSTRAINT: CompetenceTreeLevel CompetenceTreeLevel_pkey
ALTER TABLE ONLY public."CompetenceTreeLevel"
    ADD CONSTRAINT "CompetenceTreeLevel_pkey" PRIMARY KEY (id);

-- CONSTRAINT: CompetenceTreeNode CompetenceTreeNode_pkey
ALTER TABLE ONLY public."CompetenceTreeNode"
    ADD CONSTRAINT "CompetenceTreeNode_pkey" PRIMARY KEY (id);

-- CONSTRAINT: CompetenceTreeScaleApproval CompetenceTreeScaleApproval_pkey
ALTER TABLE ONLY public."CompetenceTreeScaleApproval"
    ADD CONSTRAINT "CompetenceTreeScaleApproval_pkey" PRIMARY KEY (id);

-- CONSTRAINT: CompetenceTreeScaleLevel CompetenceTreeScaleLevel_pkey
ALTER TABLE ONLY public."CompetenceTreeScaleLevel"
    ADD CONSTRAINT "CompetenceTreeScaleLevel_pkey" PRIMARY KEY (id);

-- CONSTRAINT: CompetenceTreeScaleLinkAnchor CompetenceTreeScaleLinkAnchor_pkey
ALTER TABLE ONLY public."CompetenceTreeScaleLinkAnchor"
    ADD CONSTRAINT "CompetenceTreeScaleLinkAnchor_pkey" PRIMARY KEY (id);

-- CONSTRAINT: CompetenceTreeScaleLink CompetenceTreeScaleLink_pkey
ALTER TABLE ONLY public."CompetenceTreeScaleLink"
    ADD CONSTRAINT "CompetenceTreeScaleLink_pkey" PRIMARY KEY (id);

-- CONSTRAINT: CompetenceTreeScaleVersion CompetenceTreeScaleVersion_pkey
ALTER TABLE ONLY public."CompetenceTreeScaleVersion"
    ADD CONSTRAINT "CompetenceTreeScaleVersion_pkey" PRIMARY KEY (id);

-- CONSTRAINT: CompetenceTree CompetenceTree_pkey
ALTER TABLE ONLY public."CompetenceTree"
    ADD CONSTRAINT "CompetenceTree_pkey" PRIMARY KEY (id);

-- CONSTRAINT: PracticeQuizAdaptiveConfig PracticeQuizAdaptiveConfig_pkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveConfig"
    ADD CONSTRAINT "PracticeQuizAdaptiveConfig_pkey" PRIMARY KEY (id);

-- CONSTRAINT: PracticeQuizAdaptiveElementOverride PracticeQuizAdaptiveElementOverride_pkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveElementOverride"
    ADD CONSTRAINT "PracticeQuizAdaptiveElementOverride_pkey" PRIMARY KEY (id);

-- CONSTRAINT: PracticeQuizAdaptiveNodeOverride PracticeQuizAdaptiveNodeOverride_pkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveNodeOverride"
    ADD CONSTRAINT "PracticeQuizAdaptiveNodeOverride_pkey" PRIMARY KEY (id);

-- CONSTRAINT: PracticeQuizAdaptivePoolItem PracticeQuizAdaptivePoolItem_pkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePoolItem"
    ADD CONSTRAINT "PracticeQuizAdaptivePoolItem_pkey" PRIMARY KEY (id);

-- CONSTRAINT: PracticeQuizAdaptivePublication PracticeQuizAdaptivePublication_pkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePublication"
    ADD CONSTRAINT "PracticeQuizAdaptivePublication_pkey" PRIMARY KEY (id);

-- CONSTRAINT: _AdditionalAssignmentLeaves _AdditionalAssignmentLeaves_AB_pkey
ALTER TABLE ONLY public."_AdditionalAssignmentLeaves"
    ADD CONSTRAINT "_AdditionalAssignmentLeaves_AB_pkey" PRIMARY KEY ("A", "B");

-- INDEX: AdaptiveAssessmentAttempt_assessmentId_participantId_status_idx
CREATE INDEX "AdaptiveAssessmentAttempt_assessmentId_participantId_status_idx" ON public."AdaptiveAssessmentAttempt" USING btree ("assessmentId", "participantId", status);

-- INDEX: AdaptiveAssessmentAttempt_participationId_idx
CREATE INDEX "AdaptiveAssessmentAttempt_participationId_idx" ON public."AdaptiveAssessmentAttempt" USING btree ("participationId");

-- INDEX: AdaptiveAssessmentCompetence_assessmentId_name_key
CREATE UNIQUE INDEX "AdaptiveAssessmentCompetence_assessmentId_name_key" ON public."AdaptiveAssessmentCompetence" USING btree ("assessmentId", name);

-- INDEX: AdaptiveAssessmentCompetence_assessmentId_order_key
CREATE UNIQUE INDEX "AdaptiveAssessmentCompetence_assessmentId_order_key" ON public."AdaptiveAssessmentCompetence" USING btree ("assessmentId", "order");

-- INDEX: AdaptiveAssessmentElement_assessmentId_elementId_competenceId_s
CREATE UNIQUE INDEX "AdaptiveAssessmentElement_assessmentId_elementId_competenceId_s" ON public."AdaptiveAssessmentElement" USING btree ("assessmentId", "elementId", "competenceId", "subCompetenceId", "levelId");

-- INDEX: AdaptiveAssessmentElement_assessmentId_enabled_idx
CREATE INDEX "AdaptiveAssessmentElement_assessmentId_enabled_idx" ON public."AdaptiveAssessmentElement" USING btree ("assessmentId", enabled);

-- INDEX: AdaptiveAssessmentElement_elementId_idx
CREATE INDEX "AdaptiveAssessmentElement_elementId_idx" ON public."AdaptiveAssessmentElement" USING btree ("elementId");

-- INDEX: AdaptiveAssessmentLevel_assessmentId_label_key
CREATE UNIQUE INDEX "AdaptiveAssessmentLevel_assessmentId_label_key" ON public."AdaptiveAssessmentLevel" USING btree ("assessmentId", label);

-- INDEX: AdaptiveAssessmentLevel_assessmentId_order_key
CREATE UNIQUE INDEX "AdaptiveAssessmentLevel_assessmentId_order_key" ON public."AdaptiveAssessmentLevel" USING btree ("assessmentId", "order");

-- INDEX: AdaptiveAssessmentResponse_adaptiveElementId_idx
CREATE INDEX "AdaptiveAssessmentResponse_adaptiveElementId_idx" ON public."AdaptiveAssessmentResponse" USING btree ("adaptiveElementId");

-- INDEX: AdaptiveAssessmentResponse_attemptId_idx
CREATE INDEX "AdaptiveAssessmentResponse_attemptId_idx" ON public."AdaptiveAssessmentResponse" USING btree ("attemptId");

-- INDEX: AdaptiveAssessmentResponse_attemptId_order_key
CREATE UNIQUE INDEX "AdaptiveAssessmentResponse_attemptId_order_key" ON public."AdaptiveAssessmentResponse" USING btree ("attemptId", "order");

-- INDEX: AdaptiveAssessmentResponse_elementId_idx
CREATE INDEX "AdaptiveAssessmentResponse_elementId_idx" ON public."AdaptiveAssessmentResponse" USING btree ("elementId");

-- INDEX: AdaptiveAssessmentResultMessage_assessmentId_isFallback_idx
CREATE INDEX "AdaptiveAssessmentResultMessage_assessmentId_isFallback_idx" ON public."AdaptiveAssessmentResultMessage" USING btree ("assessmentId", "isFallback");

-- INDEX: AdaptiveAssessmentResultMessage_assessmentId_order_key
CREATE UNIQUE INDEX "AdaptiveAssessmentResultMessage_assessmentId_order_key" ON public."AdaptiveAssessmentResultMessage" USING btree ("assessmentId", "order");

-- INDEX: AdaptiveAssessmentSubCompetence_assessmentId_competenceId_name_
CREATE UNIQUE INDEX "AdaptiveAssessmentSubCompetence_assessmentId_competenceId_name_" ON public."AdaptiveAssessmentSubCompetence" USING btree ("assessmentId", "competenceId", name);

-- INDEX: AdaptiveAssessmentSubCompetence_assessmentId_competenceId_order
CREATE UNIQUE INDEX "AdaptiveAssessmentSubCompetence_assessmentId_competenceId_order" ON public."AdaptiveAssessmentSubCompetence" USING btree ("assessmentId", "competenceId", "order");

-- INDEX: AdaptiveAssessment_courseId_idx
CREATE INDEX "AdaptiveAssessment_courseId_idx" ON public."AdaptiveAssessment" USING btree ("courseId");

-- INDEX: AdaptiveAssessment_ownerId_idx
CREATE INDEX "AdaptiveAssessment_ownerId_idx" ON public."AdaptiveAssessment" USING btree ("ownerId");

-- INDEX: AdaptiveAssessment_status_idx
CREATE INDEX "AdaptiveAssessment_status_idx" ON public."AdaptiveAssessment" USING btree (status);

-- INDEX: _AdditionalAssignmentLeaves_B_index
CREATE INDEX "_AdditionalAssignmentLeaves_B_index" ON public."_AdditionalAssignmentLeaves" USING btree ("B");

-- INDEX: acer_requester_created_idx
CREATE INDEX acer_requester_created_idx ON public."AdaptiveCalibrationExportRequest" USING btree ("requestedById", "createdAt");

-- INDEX: acer_status_expiry_idx
CREATE INDEX acer_status_expiry_idx ON public."AdaptiveCalibrationExportRequest" USING btree (status, "expiresAt");

-- INDEX: acer_tree_scale_status_idx
CREATE INDEX acer_tree_scale_status_idx ON public."AdaptiveCalibrationExportRequest" USING btree ("treeId", "scaleVersionId", status);

-- INDEX: aic_approved_by_idx
CREATE INDEX aic_approved_by_idx ON public."AdaptiveItemCalibration" USING btree ("approvedById");

-- INDEX: aic_assignment_element_version_idx
CREATE INDEX aic_assignment_element_version_idx ON public."AdaptiveItemCalibration" USING btree ("assignmentId", "elementId", "elementVersion");

-- INDEX: aic_measurement_version_key
CREATE UNIQUE INDEX aic_measurement_version_key ON public."AdaptiveItemCalibration" USING btree ("treeId", "scaleVersionId", "assignmentId", "elementId", "elementVersion", version);

-- INDEX: aic_pool_identity_key
CREATE UNIQUE INDEX aic_pool_identity_key ON public."AdaptiveItemCalibration" USING btree ("treeId", "scaleVersionId", id, "assignmentId", "elementId", "elementVersion");

-- INDEX: aic_scale_status_idx
CREATE INDEX aic_scale_status_idx ON public."AdaptiveItemCalibration" USING btree ("scaleVersionId", status);

-- INDEX: aic_tree_scale_id_key
CREATE UNIQUE INDEX aic_tree_scale_id_key ON public."AdaptiveItemCalibration" USING btree ("treeId", "scaleVersionId", id);

-- INDEX: apqa_config_next_pool_idx
CREATE INDEX apqa_config_next_pool_idx ON public."AdaptivePracticeQuizAttempt" USING btree ("configId", "nextPoolItemId");

-- INDEX: apqa_config_quiz_idx
CREATE INDEX apqa_config_quiz_idx ON public."AdaptivePracticeQuizAttempt" USING btree ("configId", "practiceQuizId");

-- INDEX: apqa_course_retention_idx
CREATE INDEX apqa_course_retention_idx ON public."AdaptivePracticeQuizAttempt" USING btree ("courseId");

-- INDEX: apqa_final_level_idx
CREATE INDEX apqa_final_level_idx ON public."AdaptivePracticeQuizAttempt" USING btree ("finalLevelId");

-- INDEX: apqa_id_config_key
CREATE UNIQUE INDEX apqa_id_config_key ON public."AdaptivePracticeQuizAttempt" USING btree (id, "configId");

-- INDEX: apqa_id_config_publication_key
CREATE UNIQUE INDEX apqa_id_config_publication_key ON public."AdaptivePracticeQuizAttempt" USING btree (id, "configId", "publicationId");

-- INDEX: apqa_id_config_tree_key
CREATE UNIQUE INDEX apqa_id_config_tree_key ON public."AdaptivePracticeQuizAttempt" USING btree (id, "configId", "competenceTreeId");

-- INDEX: apqa_next_pool_item_idx
CREATE INDEX apqa_next_pool_item_idx ON public."AdaptivePracticeQuizAttempt" USING btree ("nextPoolItemId");

-- INDEX: apqa_one_in_progress_key
CREATE UNIQUE INDEX apqa_one_in_progress_key ON public."AdaptivePracticeQuizAttempt" USING btree ("practiceQuizId", "participantId") WHERE (status = 'IN_PROGRESS'::public."AdaptivePracticeQuizAttemptStatus");

-- INDEX: apqa_participation_identity_idx
CREATE INDEX apqa_participation_identity_idx ON public."AdaptivePracticeQuizAttempt" USING btree ("participationId", "participantId", "courseId");

-- INDEX: apqa_participation_quiz_idx
CREATE INDEX apqa_participation_quiz_idx ON public."AdaptivePracticeQuizAttempt" USING btree ("participationId", "practiceQuizId");

-- INDEX: apqa_publication_next_pool_idx
CREATE INDEX apqa_publication_next_pool_idx ON public."AdaptivePracticeQuizAttempt" USING btree ("publicationId", "nextPoolItemId");

-- INDEX: apqa_quiz_participant_completed_idx
CREATE INDEX apqa_quiz_participant_completed_idx ON public."AdaptivePracticeQuizAttempt" USING btree ("practiceQuizId", "participantId", status, "completedAt", id);

-- INDEX: apqa_quiz_participant_status_idx
CREATE INDEX apqa_quiz_participant_status_idx ON public."AdaptivePracticeQuizAttempt" USING btree ("practiceQuizId", "participantId", status);

-- INDEX: apqa_quiz_status_completed_idx
CREATE INDEX apqa_quiz_status_completed_idx ON public."AdaptivePracticeQuizAttempt" USING btree ("practiceQuizId", status, "completedAt", id);

-- INDEX: apqa_scale_version_idx
CREATE INDEX apqa_scale_version_idx ON public."AdaptivePracticeQuizAttempt" USING btree ("scaleVersionId");

-- INDEX: apqcs_config_valid_release_idx
CREATE INDEX apqcs_config_valid_release_idx ON public."AdaptivePracticeQuizCohortSnapshot" USING btree ("configId", "invalidatedAt", "releaseSize");

-- INDEX: apqcs_publication_release_policy_key
CREATE UNIQUE INDEX apqcs_publication_release_policy_key ON public."AdaptivePracticeQuizCohortSnapshot" USING btree ("publicationId", "releaseSize", "policyVersion", "attemptSelectionPolicy");

-- INDEX: apqcs_quiz_retention_idx
CREATE INDEX apqcs_quiz_retention_idx ON public."AdaptivePracticeQuizCohortSnapshot" USING btree ("practiceQuizId");

-- INDEX: apqe_attempt_kind_node_key
CREATE UNIQUE INDEX apqe_attempt_kind_node_key ON public."AdaptivePracticeQuizEstimate" USING btree ("attemptId", "nodeKind", "nodeId");

-- INDEX: apqe_attempt_kind_overall_key
CREATE UNIQUE INDEX apqe_attempt_kind_overall_key ON public."AdaptivePracticeQuizEstimate" USING btree ("attemptId", "nodeKind") WHERE ("nodeId" IS NULL);

-- INDEX: apqe_attempt_node_level_idx
CREATE INDEX apqe_attempt_node_level_idx ON public."AdaptivePracticeQuizEstimate" USING btree ("attemptId", "nodeKind", "nodeId", "levelId");

-- INDEX: apqe_config_tree_idx
CREATE INDEX apqe_config_tree_idx ON public."AdaptivePracticeQuizEstimate" USING btree ("configId", "competenceTreeId");

-- INDEX: apqe_kind_level_idx
CREATE INDEX apqe_kind_level_idx ON public."AdaptivePracticeQuizEstimate" USING btree ("nodeKind", "levelId");

-- INDEX: apqev_approved_by_idx
CREATE INDEX apqev_approved_by_idx ON public."AdaptivePracticeQuizEmpiricalValidation" USING btree ("approvedById");

-- INDEX: apqev_config_status_idx
CREATE INDEX apqev_config_status_idx ON public."AdaptivePracticeQuizEmpiricalValidation" USING btree ("configId", status);

-- INDEX: apqev_evidence_identity_key
CREATE UNIQUE INDEX apqev_evidence_identity_key ON public."AdaptivePracticeQuizEmpiricalValidation" USING btree ("configId", "bankFingerprint", "configFingerprint", "scaleVersionId", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion", "validationProtocolVersion", "approvedProbabilityThreshold", "exportRequestId", "criterionArtifactChecksum");

-- INDEX: apqev_export_request_idx
CREATE INDEX apqev_export_request_idx ON public."AdaptivePracticeQuizEmpiricalValidation" USING btree ("exportRequestId");

-- INDEX: apqev_publication_identity_key
CREATE UNIQUE INDEX apqev_publication_identity_key ON public."AdaptivePracticeQuizEmpiricalValidation" USING btree (id, "configId", "competenceTreeId", "scaleVersionId", "measurementVersion", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion");

-- INDEX: apqev_scale_idx
CREATE INDEX apqev_scale_idx ON public."AdaptivePracticeQuizEmpiricalValidation" USING btree ("scaleVersionId");

-- INDEX: apqev_submitted_by_idx
CREATE INDEX apqev_submitted_by_idx ON public."AdaptivePracticeQuizEmpiricalValidation" USING btree ("submittedById");

-- INDEX: apqie_publication_pool_key
CREATE UNIQUE INDEX apqie_publication_pool_key ON public."AdaptivePracticeQuizItemExposure" USING btree ("publicationId", "poolItemId");

-- INDEX: apqie_publication_served_idx
CREATE INDEX apqie_publication_served_idx ON public."AdaptivePracticeQuizItemExposure" USING btree ("publicationId", "servedCount");

-- INDEX: apqr_assignment_idx
CREATE INDEX apqr_assignment_idx ON public."AdaptivePracticeQuizResponse" USING btree ("assignmentId");

-- INDEX: apqr_attempt_assignment_key
CREATE UNIQUE INDEX apqr_attempt_assignment_key ON public."AdaptivePracticeQuizResponse" USING btree ("attemptId", "assignmentId");

-- INDEX: apqr_attempt_order_key
CREATE UNIQUE INDEX apqr_attempt_order_key ON public."AdaptivePracticeQuizResponse" USING btree ("attemptId", "order");

-- INDEX: apqr_config_pool_attempt_idx
CREATE INDEX apqr_config_pool_attempt_idx ON public."AdaptivePracticeQuizResponse" USING btree ("configId", "poolItemId", "attemptId");

-- INDEX: apqr_config_pool_idx
CREATE INDEX apqr_config_pool_idx ON public."AdaptivePracticeQuizResponse" USING btree ("configId", "poolItemId");

-- INDEX: apqr_pool_item_idx
CREATE INDEX apqr_pool_item_idx ON public."AdaptivePracticeQuizResponse" USING btree ("poolItemId");

-- INDEX: apqr_publication_pool_attempt_idx
CREATE INDEX apqr_publication_pool_attempt_idx ON public."AdaptivePracticeQuizResponse" USING btree ("publicationId", "poolItemId", "attemptId");

-- INDEX: ct_owner_idx
CREATE INDEX ct_owner_idx ON public."CompetenceTree" USING btree ("ownerId");

-- INDEX: ctc_course_idx
CREATE INDEX ctc_course_idx ON public."CompetenceTreeCourse" USING btree ("courseId");

-- INDEX: ctc_linked_by_idx
CREATE INDEX ctc_linked_by_idx ON public."CompetenceTreeCourse" USING btree ("linkedById");

-- INDEX: ctc_tree_course_key
CREATE UNIQUE INDEX ctc_tree_course_key ON public."CompetenceTreeCourse" USING btree ("treeId", "courseId");

-- INDEX: ctea_element_idx
CREATE INDEX ctea_element_idx ON public."CompetenceTreeElementAssignment" USING btree ("elementId");

-- INDEX: ctea_tree_element_key
CREATE UNIQUE INDEX ctea_tree_element_key ON public."CompetenceTreeElementAssignment" USING btree ("treeId", "elementId");

-- INDEX: ctea_tree_id_element_key
CREATE UNIQUE INDEX ctea_tree_id_element_key ON public."CompetenceTreeElementAssignment" USING btree ("treeId", id, "elementId");

-- INDEX: ctea_tree_id_key
CREATE UNIQUE INDEX ctea_tree_id_key ON public."CompetenceTreeElementAssignment" USING btree ("treeId", id);

-- INDEX: ctea_tree_leaf_enabled_idx
CREATE INDEX ctea_tree_leaf_enabled_idx ON public."CompetenceTreeElementAssignment" USING btree ("treeId", "leafNodeId", enabled);

-- INDEX: ctl_tree_id_key
CREATE UNIQUE INDEX ctl_tree_id_key ON public."CompetenceTreeLevel" USING btree ("treeId", id);

-- INDEX: ctl_tree_label_key
CREATE UNIQUE INDEX ctl_tree_label_key ON public."CompetenceTreeLevel" USING btree ("treeId", label);

-- INDEX: ctl_tree_order_key
CREATE UNIQUE INDEX ctl_tree_order_key ON public."CompetenceTreeLevel" USING btree ("treeId", "order");

-- INDEX: ctlc_tree_leaf_level_key
CREATE UNIQUE INDEX ctlc_tree_leaf_level_key ON public."CompetenceTreeLeafLevelCoverage" USING btree ("treeId", "leafNodeId", "levelId");

-- INDEX: ctn_tree_id_key
CREATE UNIQUE INDEX ctn_tree_id_key ON public."CompetenceTreeNode" USING btree ("treeId", id);

-- INDEX: ctn_tree_order_idx
CREATE INDEX ctn_tree_order_idx ON public."CompetenceTreeNode" USING btree ("treeId", "order");

-- INDEX: ctn_tree_parent_idx
CREATE INDEX ctn_tree_parent_idx ON public."CompetenceTreeNode" USING btree ("treeId", "parentId");

-- INDEX: ctn_tree_parent_order_key
CREATE UNIQUE INDEX ctn_tree_parent_order_key ON public."CompetenceTreeNode" USING btree ("treeId", "parentId", "order");

-- INDEX: ctn_tree_root_order_key
CREATE UNIQUE INDEX ctn_tree_root_order_key ON public."CompetenceTreeNode" USING btree ("treeId", "order") WHERE ("parentId" IS NULL);

-- INDEX: ctsa_reviewer_idx
CREATE INDEX ctsa_reviewer_idx ON public."CompetenceTreeScaleApproval" USING btree ("reviewerId");

-- INDEX: ctsa_submitted_by_idx
CREATE INDEX ctsa_submitted_by_idx ON public."CompetenceTreeScaleApproval" USING btree ("submittedById");

-- INDEX: ctsa_tree_scale_idx
CREATE INDEX ctsa_tree_scale_idx ON public."CompetenceTreeScaleApproval" USING btree ("treeId", "scaleVersionId");

-- INDEX: ctsl_scale_id_key
CREATE UNIQUE INDEX ctsl_scale_id_key ON public."CompetenceTreeScaleLevel" USING btree ("scaleVersionId", id);

-- INDEX: ctsl_scale_order_key
CREATE UNIQUE INDEX ctsl_scale_order_key ON public."CompetenceTreeScaleLevel" USING btree ("scaleVersionId", "order");

-- INDEX: ctsl_tree_scale_id_key
CREATE UNIQUE INDEX ctsl_tree_scale_id_key ON public."CompetenceTreeScaleLevel" USING btree ("treeId", "scaleVersionId", id);

-- INDEX: ctsl_tree_source_level_idx
CREATE INDEX ctsl_tree_source_level_idx ON public."CompetenceTreeScaleLevel" USING btree ("treeId", "sourceLevelId");

-- INDEX: ctsla_from_calibration_idx
CREATE INDEX ctsla_from_calibration_idx ON public."CompetenceTreeScaleLinkAnchor" USING btree ("fromCalibrationId");

-- INDEX: ctsla_link_from_key
CREATE UNIQUE INDEX ctsla_link_from_key ON public."CompetenceTreeScaleLinkAnchor" USING btree ("scaleLinkId", "fromCalibrationId");

-- INDEX: ctsla_link_order_key
CREATE UNIQUE INDEX ctsla_link_order_key ON public."CompetenceTreeScaleLinkAnchor" USING btree ("scaleLinkId", "order");

-- INDEX: ctsla_link_to_key
CREATE UNIQUE INDEX ctsla_link_to_key ON public."CompetenceTreeScaleLinkAnchor" USING btree ("scaleLinkId", "toCalibrationId");

-- INDEX: ctsla_to_calibration_idx
CREATE INDEX ctsla_to_calibration_idx ON public."CompetenceTreeScaleLinkAnchor" USING btree ("toCalibrationId");

-- INDEX: ctslk_created_by_idx
CREATE INDEX ctslk_created_by_idx ON public."CompetenceTreeScaleLink" USING btree ("createdById");

-- INDEX: ctslk_reviewed_by_idx
CREATE INDEX ctslk_reviewed_by_idx ON public."CompetenceTreeScaleLink" USING btree ("reviewedById");

-- INDEX: ctslk_tree_versions_key
CREATE UNIQUE INDEX ctslk_tree_versions_key ON public."CompetenceTreeScaleLink" USING btree ("treeId", "fromScaleVersionId", "toScaleVersionId");

-- INDEX: ctsv_created_by_idx
CREATE INDEX ctsv_created_by_idx ON public."CompetenceTreeScaleVersion" USING btree ("createdById");

-- INDEX: ctsv_one_active_per_tree_key
CREATE UNIQUE INDEX ctsv_one_active_per_tree_key ON public."CompetenceTreeScaleVersion" USING btree ("treeId") WHERE (status = 'ACTIVE'::public."AdaptiveScaleVersionStatus");

-- INDEX: ctsv_tree_id_key
CREATE UNIQUE INDEX ctsv_tree_id_key ON public."CompetenceTreeScaleVersion" USING btree ("treeId", id);

-- INDEX: ctsv_tree_status_idx
CREATE INDEX ctsv_tree_status_idx ON public."CompetenceTreeScaleVersion" USING btree ("treeId", status);

-- INDEX: ctsv_tree_version_key
CREATE UNIQUE INDEX ctsv_tree_version_key ON public."CompetenceTreeScaleVersion" USING btree ("treeId", version);

-- INDEX: element_creation_request_key
CREATE UNIQUE INDEX element_creation_request_key ON public."Element" USING btree ("creationRequestId");

-- INDEX: participation_identity_key
CREATE UNIQUE INDEX participation_identity_key ON public."Participation" USING btree (id, "participantId", "courseId");

-- INDEX: pqac_id_quiz_key
CREATE UNIQUE INDEX pqac_id_quiz_key ON public."PracticeQuizAdaptiveConfig" USING btree (id, "practiceQuizId");

-- INDEX: pqac_id_quiz_tree_key
CREATE UNIQUE INDEX pqac_id_quiz_tree_key ON public."PracticeQuizAdaptiveConfig" USING btree (id, "practiceQuizId", "competenceTreeId");

-- INDEX: pqac_id_tree_key
CREATE UNIQUE INDEX pqac_id_tree_key ON public."PracticeQuizAdaptiveConfig" USING btree (id, "competenceTreeId");

-- INDEX: pqac_practice_quiz_key
CREATE UNIQUE INDEX pqac_practice_quiz_key ON public."PracticeQuizAdaptiveConfig" USING btree ("practiceQuizId");

-- INDEX: pqac_tree_idx
CREATE INDEX pqac_tree_idx ON public."PracticeQuizAdaptiveConfig" USING btree ("competenceTreeId");

-- INDEX: pqae_config_assignment_key
CREATE UNIQUE INDEX pqae_config_assignment_key ON public."PracticeQuizAdaptiveElementOverride" USING btree ("configId", "assignmentId");

-- INDEX: pqae_tree_assignment_idx
CREATE INDEX pqae_tree_assignment_idx ON public."PracticeQuizAdaptiveElementOverride" USING btree ("competenceTreeId", "assignmentId");

-- INDEX: pqan_config_node_key
CREATE UNIQUE INDEX pqan_config_node_key ON public."PracticeQuizAdaptiveNodeOverride" USING btree ("configId", "nodeId");

-- INDEX: pqan_tree_node_idx
CREATE INDEX pqan_tree_node_idx ON public."PracticeQuizAdaptiveNodeOverride" USING btree ("competenceTreeId", "nodeId");

-- INDEX: pqap_config_id_key
CREATE UNIQUE INDEX pqap_config_id_key ON public."PracticeQuizAdaptivePublication" USING btree ("configId", id);

-- INDEX: pqap_config_version_key
CREATE UNIQUE INDEX pqap_config_version_key ON public."PracticeQuizAdaptivePublication" USING btree ("configId", version);

-- INDEX: pqap_dispatch_identity_key
CREATE UNIQUE INDEX pqap_dispatch_identity_key ON public."PracticeQuizAdaptivePublication" USING btree (id, "configId", "competenceTreeId", "scaleVersionId", "measurementVersion", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion");

-- INDEX: pqap_id_config_tree_key
CREATE UNIQUE INDEX pqap_id_config_tree_key ON public."PracticeQuizAdaptivePublication" USING btree (id, "configId", "competenceTreeId");

-- INDEX: pqap_id_scale_measurement_key
CREATE UNIQUE INDEX pqap_id_scale_measurement_key ON public."PracticeQuizAdaptivePublication" USING btree (id, "scaleVersionId", "measurementVersion");

-- INDEX: pqap_one_active_per_config_key
CREATE UNIQUE INDEX pqap_one_active_per_config_key ON public."PracticeQuizAdaptivePublication" USING btree ("configId") WHERE (("sealedAt" IS NOT NULL) AND ("supersededAt" IS NULL) AND ("unpublishedAt" IS NULL));

-- INDEX: pqap_published_by_idx
CREATE INDEX pqap_published_by_idx ON public."PracticeQuizAdaptivePublication" USING btree ("publishedById");

-- INDEX: pqap_scale_idx
CREATE INDEX pqap_scale_idx ON public."PracticeQuizAdaptivePublication" USING btree ("scaleVersionId");

-- INDEX: pqap_tree_id_key
CREATE UNIQUE INDEX pqap_tree_id_key ON public."PracticeQuizAdaptivePublication" USING btree ("competenceTreeId", id);

-- INDEX: pqap_validation_idx
CREATE INDEX pqap_validation_idx ON public."PracticeQuizAdaptivePublication" USING btree ("empiricalValidationId");

-- INDEX: pqapi_calibration_idx
CREATE INDEX pqapi_calibration_idx ON public."PracticeQuizAdaptivePoolItem" USING btree ("calibrationId");

-- INDEX: pqapi_config_id_key
CREATE UNIQUE INDEX pqapi_config_id_key ON public."PracticeQuizAdaptivePoolItem" USING btree ("configId", id);

-- INDEX: pqapi_element_version_idx
CREATE INDEX pqapi_element_version_idx ON public."PracticeQuizAdaptivePoolItem" USING btree ("elementId", "elementVersion");

-- INDEX: pqapi_publication_assignment_key
CREATE UNIQUE INDEX pqapi_publication_assignment_key ON public."PracticeQuizAdaptivePoolItem" USING btree ("publicationId", "sourceAssignmentId");

-- INDEX: pqapi_publication_id_key
CREATE UNIQUE INDEX pqapi_publication_id_key ON public."PracticeQuizAdaptivePoolItem" USING btree ("publicationId", id);

-- INDEX: pqapi_publication_leaf_level_idx
CREATE INDEX pqapi_publication_leaf_level_idx ON public."PracticeQuizAdaptivePoolItem" USING btree ("publicationId", "leafNodeId", "levelId");

-- INDEX: pqapi_publication_response_key
CREATE UNIQUE INDEX pqapi_publication_response_key ON public."PracticeQuizAdaptivePoolItem" USING btree ("publicationId", id, "sourceAssignmentId", "elementId");

-- INDEX: pqapi_response_identity_key
CREATE UNIQUE INDEX pqapi_response_identity_key ON public."PracticeQuizAdaptivePoolItem" USING btree ("configId", id, "sourceAssignmentId", "elementId");

-- INDEX: practice_quiz_id_course_key
CREATE UNIQUE INDEX practice_quiz_id_course_key ON public."PracticeQuiz" USING btree (id, "courseId");

-- TRIGGER: AdaptiveItemCalibration aic_immutability_guard
CREATE TRIGGER aic_immutability_guard BEFORE DELETE OR UPDATE ON public."AdaptiveItemCalibration" FOR EACH ROW EXECUTE FUNCTION public.adaptive_calibration_immutability_guard();

-- TRIGGER: AdaptiveItemCalibration aic_independent_reviewer
CREATE TRIGGER aic_independent_reviewer BEFORE INSERT OR UPDATE ON public."AdaptiveItemCalibration" FOR EACH ROW EXECUTE FUNCTION public.adaptive_independent_review_guard();

-- TRIGGER: AdaptivePracticeQuizAttempt apqa_invalidate_cohort_snapshots_after_delete
CREATE TRIGGER apqa_invalidate_cohort_snapshots_after_delete AFTER DELETE ON public."AdaptivePracticeQuizAttempt" REFERENCING OLD TABLE AS deleted_adaptive_attempts FOR EACH STATEMENT EXECUTE FUNCTION public.invalidate_adaptive_cohort_snapshots_on_attempt_delete();

-- TRIGGER: AdaptivePracticeQuizAttempt apqa_sealed_publication_guard
CREATE TRIGGER apqa_sealed_publication_guard BEFORE INSERT OR UPDATE ON public."AdaptivePracticeQuizAttempt" FOR EACH ROW EXECUTE FUNCTION public.adaptive_attempt_publication_guard();

-- TRIGGER: AdaptivePracticeQuizEmpiricalValidation apqev_evidence_immutability_guard
CREATE TRIGGER apqev_evidence_immutability_guard BEFORE DELETE OR UPDATE ON public."AdaptivePracticeQuizEmpiricalValidation" FOR EACH ROW EXECUTE FUNCTION public.adaptive_review_evidence_immutability_guard();

-- TRIGGER: AdaptivePracticeQuizEmpiricalValidation apqev_independent_reviewer
CREATE TRIGGER apqev_independent_reviewer BEFORE INSERT OR UPDATE ON public."AdaptivePracticeQuizEmpiricalValidation" FOR EACH ROW EXECUTE FUNCTION public.adaptive_independent_review_guard();

-- TRIGGER: AdaptivePracticeQuizResponse apqr_design_identity_guard
CREATE TRIGGER apqr_design_identity_guard BEFORE INSERT OR UPDATE ON public."AdaptivePracticeQuizResponse" FOR EACH ROW EXECUTE FUNCTION public.adaptive_response_design_guard();

-- TRIGGER: CompetenceTreeScaleApproval ctsa_evidence_immutability_guard
CREATE TRIGGER ctsa_evidence_immutability_guard BEFORE DELETE OR UPDATE ON public."CompetenceTreeScaleApproval" FOR EACH ROW EXECUTE FUNCTION public.adaptive_review_evidence_immutability_guard();

-- TRIGGER: CompetenceTreeScaleApproval ctsa_independent_reviewer
CREATE TRIGGER ctsa_independent_reviewer BEFORE INSERT OR UPDATE ON public."CompetenceTreeScaleApproval" FOR EACH ROW EXECUTE FUNCTION public.adaptive_independent_review_guard();

-- TRIGGER: CompetenceTreeScaleLevel ctsl_lifecycle_guard
CREATE TRIGGER ctsl_lifecycle_guard BEFORE INSERT OR DELETE OR UPDATE ON public."CompetenceTreeScaleLevel" FOR EACH ROW EXECUTE FUNCTION public.adaptive_scale_level_guard();

-- TRIGGER: CompetenceTreeScaleLinkAnchor ctsla_identity_guard
CREATE TRIGGER ctsla_identity_guard BEFORE INSERT OR DELETE OR UPDATE ON public."CompetenceTreeScaleLinkAnchor" FOR EACH ROW EXECUTE FUNCTION public.adaptive_scale_link_anchor_guard();

-- TRIGGER: CompetenceTreeScaleLink ctslk_independent_reviewer
CREATE TRIGGER ctslk_independent_reviewer BEFORE INSERT OR UPDATE ON public."CompetenceTreeScaleLink" FOR EACH ROW EXECUTE FUNCTION public.adaptive_independent_review_guard();

-- TRIGGER: CompetenceTreeScaleLink ctslk_lifecycle_guard
CREATE TRIGGER ctslk_lifecycle_guard BEFORE INSERT OR DELETE OR UPDATE ON public."CompetenceTreeScaleLink" FOR EACH ROW EXECUTE FUNCTION public.adaptive_scale_link_guard();

-- TRIGGER: CompetenceTreeScaleVersion ctsv_lifecycle_guard
CREATE TRIGGER ctsv_lifecycle_guard BEFORE INSERT OR UPDATE ON public."CompetenceTreeScaleVersion" FOR EACH ROW EXECUTE FUNCTION public.adaptive_scale_version_guard();

-- TRIGGER: PracticeQuizAdaptivePublication pqap_publication_guard
CREATE TRIGGER pqap_publication_guard BEFORE INSERT OR DELETE OR UPDATE ON public."PracticeQuizAdaptivePublication" FOR EACH ROW EXECUTE FUNCTION public.adaptive_publication_guard();

-- TRIGGER: PracticeQuizAdaptivePoolItem pqapi_snapshot_guard
CREATE TRIGGER pqapi_snapshot_guard BEFORE INSERT OR DELETE OR UPDATE ON public."PracticeQuizAdaptivePoolItem" FOR EACH ROW EXECUTE FUNCTION public.adaptive_pool_snapshot_guard();

-- FK CONSTRAINT: AdaptiveAssessmentAttempt AdaptiveAssessmentAttempt_assessmentId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentAttempt"
    ADD CONSTRAINT "AdaptiveAssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES public."AdaptiveAssessment"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentAttempt AdaptiveAssessmentAttempt_participantId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentAttempt"
    ADD CONSTRAINT "AdaptiveAssessmentAttempt_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES public."Participant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentAttempt AdaptiveAssessmentAttempt_participationId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentAttempt"
    ADD CONSTRAINT "AdaptiveAssessmentAttempt_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES public."Participation"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentCompetence AdaptiveAssessmentCompetence_assessmentId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentCompetence"
    ADD CONSTRAINT "AdaptiveAssessmentCompetence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES public."AdaptiveAssessment"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentElement AdaptiveAssessmentElement_assessmentId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentElement"
    ADD CONSTRAINT "AdaptiveAssessmentElement_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES public."AdaptiveAssessment"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentElement AdaptiveAssessmentElement_competenceId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentElement"
    ADD CONSTRAINT "AdaptiveAssessmentElement_competenceId_fkey" FOREIGN KEY ("competenceId") REFERENCES public."AdaptiveAssessmentCompetence"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentElement AdaptiveAssessmentElement_elementId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentElement"
    ADD CONSTRAINT "AdaptiveAssessmentElement_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES public."Element"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentElement AdaptiveAssessmentElement_levelId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentElement"
    ADD CONSTRAINT "AdaptiveAssessmentElement_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES public."AdaptiveAssessmentLevel"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentElement AdaptiveAssessmentElement_subCompetenceId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentElement"
    ADD CONSTRAINT "AdaptiveAssessmentElement_subCompetenceId_fkey" FOREIGN KEY ("subCompetenceId") REFERENCES public."AdaptiveAssessmentSubCompetence"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentLevel AdaptiveAssessmentLevel_assessmentId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentLevel"
    ADD CONSTRAINT "AdaptiveAssessmentLevel_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES public."AdaptiveAssessment"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentResponse AdaptiveAssessmentResponse_adaptiveElementId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentResponse"
    ADD CONSTRAINT "AdaptiveAssessmentResponse_adaptiveElementId_fkey" FOREIGN KEY ("adaptiveElementId") REFERENCES public."AdaptiveAssessmentElement"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentResponse AdaptiveAssessmentResponse_attemptId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentResponse"
    ADD CONSTRAINT "AdaptiveAssessmentResponse_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES public."AdaptiveAssessmentAttempt"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentResponse AdaptiveAssessmentResponse_elementId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentResponse"
    ADD CONSTRAINT "AdaptiveAssessmentResponse_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES public."Element"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentResultMessage AdaptiveAssessmentResultMessage_assessmentId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentResultMessage"
    ADD CONSTRAINT "AdaptiveAssessmentResultMessage_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES public."AdaptiveAssessment"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentResultMessage AdaptiveAssessmentResultMessage_levelId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentResultMessage"
    ADD CONSTRAINT "AdaptiveAssessmentResultMessage_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES public."AdaptiveAssessmentLevel"(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- FK CONSTRAINT: AdaptiveAssessmentSubCompetence AdaptiveAssessmentSubCompetence_assessmentId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentSubCompetence"
    ADD CONSTRAINT "AdaptiveAssessmentSubCompetence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES public."AdaptiveAssessment"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessmentSubCompetence AdaptiveAssessmentSubCompetence_competenceId_fkey
ALTER TABLE ONLY public."AdaptiveAssessmentSubCompetence"
    ADD CONSTRAINT "AdaptiveAssessmentSubCompetence_competenceId_fkey" FOREIGN KEY ("competenceId") REFERENCES public."AdaptiveAssessmentCompetence"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessment AdaptiveAssessment_courseId_fkey
ALTER TABLE ONLY public."AdaptiveAssessment"
    ADD CONSTRAINT "AdaptiveAssessment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveAssessment AdaptiveAssessment_ownerId_fkey
ALTER TABLE ONLY public."AdaptiveAssessment"
    ADD CONSTRAINT "AdaptiveAssessment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveCalibrationExportRequest AdaptiveCalibrationExportRequest_requestedById_fkey
ALTER TABLE ONLY public."AdaptiveCalibrationExportRequest"
    ADD CONSTRAINT "AdaptiveCalibrationExportRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- FK CONSTRAINT: AdaptiveCalibrationExportRequest AdaptiveCalibrationExportRequest_treeId_fkey
ALTER TABLE ONLY public."AdaptiveCalibrationExportRequest"
    ADD CONSTRAINT "AdaptiveCalibrationExportRequest_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES public."CompetenceTree"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptiveCalibrationExportRequest AdaptiveCalibrationExportRequest_treeId_scaleVersionId_fkey
ALTER TABLE ONLY public."AdaptiveCalibrationExportRequest"
    ADD CONSTRAINT "AdaptiveCalibrationExportRequest_treeId_scaleVersionId_fkey" FOREIGN KEY ("treeId", "scaleVersionId") REFERENCES public."CompetenceTreeScaleVersion"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptiveItemCalibration AdaptiveItemCalibration_approvedById_fkey
ALTER TABLE ONLY public."AdaptiveItemCalibration"
    ADD CONSTRAINT "AdaptiveItemCalibration_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptiveItemCalibration AdaptiveItemCalibration_createdById_fkey
ALTER TABLE ONLY public."AdaptiveItemCalibration"
    ADD CONSTRAINT "AdaptiveItemCalibration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- FK CONSTRAINT: AdaptiveItemCalibration AdaptiveItemCalibration_elementId_fkey
ALTER TABLE ONLY public."AdaptiveItemCalibration"
    ADD CONSTRAINT "AdaptiveItemCalibration_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES public."Element"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptiveItemCalibration AdaptiveItemCalibration_treeId_assignmentId_fkey
ALTER TABLE ONLY public."AdaptiveItemCalibration"
    ADD CONSTRAINT "AdaptiveItemCalibration_treeId_assignmentId_fkey" FOREIGN KEY ("treeId", "assignmentId") REFERENCES public."CompetenceTreeElementAssignment"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptiveItemCalibration AdaptiveItemCalibration_treeId_fkey
ALTER TABLE ONLY public."AdaptiveItemCalibration"
    ADD CONSTRAINT "AdaptiveItemCalibration_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES public."CompetenceTree"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptiveItemCalibration AdaptiveItemCalibration_treeId_scaleVersionId_fkey
ALTER TABLE ONLY public."AdaptiveItemCalibration"
    ADD CONSTRAINT "AdaptiveItemCalibration_treeId_scaleVersionId_fkey" FOREIGN KEY ("treeId", "scaleVersionId") REFERENCES public."CompetenceTreeScaleVersion"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizAttempt AdaptivePracticeQuizAttempt_config_quiz_tree_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizAttempt"
    ADD CONSTRAINT "AdaptivePracticeQuizAttempt_config_quiz_tree_fkey" FOREIGN KEY ("configId", "practiceQuizId", "competenceTreeId") REFERENCES public."PracticeQuizAdaptiveConfig"(id, "practiceQuizId", "competenceTreeId") ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizAttempt AdaptivePracticeQuizAttempt_courseId_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizAttempt"
    ADD CONSTRAINT "AdaptivePracticeQuizAttempt_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizAttempt AdaptivePracticeQuizAttempt_final_level_same_tree_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizAttempt"
    ADD CONSTRAINT "AdaptivePracticeQuizAttempt_final_level_same_tree_fkey" FOREIGN KEY ("competenceTreeId", "finalLevelId") REFERENCES public."CompetenceTreeLevel"("treeId", id) ON UPDATE CASCADE;

-- FK CONSTRAINT: AdaptivePracticeQuizAttempt AdaptivePracticeQuizAttempt_participantId_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizAttempt"
    ADD CONSTRAINT "AdaptivePracticeQuizAttempt_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES public."Participant"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptivePracticeQuizAttempt AdaptivePracticeQuizAttempt_participationId_participantId_cours
ALTER TABLE ONLY public."AdaptivePracticeQuizAttempt"
    ADD CONSTRAINT "AdaptivePracticeQuizAttempt_participationId_participantId_cours" FOREIGN KEY ("participationId", "participantId", "courseId") REFERENCES public."Participation"(id, "participantId", "courseId") ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptivePracticeQuizAttempt AdaptivePracticeQuizAttempt_practiceQuizId_courseId_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizAttempt"
    ADD CONSTRAINT "AdaptivePracticeQuizAttempt_practiceQuizId_courseId_fkey" FOREIGN KEY ("practiceQuizId", "courseId") REFERENCES public."PracticeQuiz"(id, "courseId") ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizAttempt AdaptivePracticeQuizAttempt_publicationId_nextPoolItemId_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizAttempt"
    ADD CONSTRAINT "AdaptivePracticeQuizAttempt_publicationId_nextPoolItemId_fkey" FOREIGN KEY ("publicationId", "nextPoolItemId") REFERENCES public."PracticeQuizAdaptivePoolItem"("publicationId", id) ON UPDATE CASCADE;

-- FK CONSTRAINT: AdaptivePracticeQuizCohortSnapshot AdaptivePracticeQuizCohortSnapshot_configId_practiceQuizId_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizCohortSnapshot"
    ADD CONSTRAINT "AdaptivePracticeQuizCohortSnapshot_configId_practiceQuizId_fkey" FOREIGN KEY ("configId", "practiceQuizId") REFERENCES public."PracticeQuizAdaptiveConfig"(id, "practiceQuizId") ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizCohortSnapshot AdaptivePracticeQuizCohortSnapshot_publication_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizCohortSnapshot"
    ADD CONSTRAINT "AdaptivePracticeQuizCohortSnapshot_publication_fkey" FOREIGN KEY ("publicationId", "scaleVersionId", "measurementVersion") REFERENCES public."PracticeQuizAdaptivePublication"(id, "scaleVersionId", "measurementVersion") ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizEmpiricalValidation AdaptivePracticeQuizEmpiricalValidation_approvedById_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizEmpiricalValidation"
    ADD CONSTRAINT "AdaptivePracticeQuizEmpiricalValidation_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizEmpiricalValidation AdaptivePracticeQuizEmpiricalValidation_competenceTreeId_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizEmpiricalValidation"
    ADD CONSTRAINT "AdaptivePracticeQuizEmpiricalValidation_competenceTreeId_fkey" FOREIGN KEY ("competenceTreeId") REFERENCES public."CompetenceTree"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizEmpiricalValidation AdaptivePracticeQuizEmpiricalValidation_configId_competenc_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizEmpiricalValidation"
    ADD CONSTRAINT "AdaptivePracticeQuizEmpiricalValidation_configId_competenc_fkey" FOREIGN KEY ("configId", "competenceTreeId") REFERENCES public."PracticeQuizAdaptiveConfig"(id, "competenceTreeId") ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizEmpiricalValidation AdaptivePracticeQuizEmpiricalValidation_exportRequestId_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizEmpiricalValidation"
    ADD CONSTRAINT "AdaptivePracticeQuizEmpiricalValidation_exportRequestId_fkey" FOREIGN KEY ("exportRequestId") REFERENCES public."AdaptiveCalibrationExportRequest"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizEmpiricalValidation AdaptivePracticeQuizEmpiricalValidation_submittedById_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizEmpiricalValidation"
    ADD CONSTRAINT "AdaptivePracticeQuizEmpiricalValidation_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- FK CONSTRAINT: AdaptivePracticeQuizEstimate AdaptivePracticeQuizEstimate_attempt_config_tree_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizEstimate"
    ADD CONSTRAINT "AdaptivePracticeQuizEstimate_attempt_config_tree_fkey" FOREIGN KEY ("attemptId", "configId", "competenceTreeId") REFERENCES public."AdaptivePracticeQuizAttempt"(id, "configId", "competenceTreeId") ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptivePracticeQuizEstimate AdaptivePracticeQuizEstimate_level_same_tree_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizEstimate"
    ADD CONSTRAINT "AdaptivePracticeQuizEstimate_level_same_tree_fkey" FOREIGN KEY ("competenceTreeId", "levelId") REFERENCES public."CompetenceTreeLevel"("treeId", id) ON UPDATE CASCADE;

-- FK CONSTRAINT: AdaptivePracticeQuizEstimate AdaptivePracticeQuizEstimate_node_same_tree_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizEstimate"
    ADD CONSTRAINT "AdaptivePracticeQuizEstimate_node_same_tree_fkey" FOREIGN KEY ("competenceTreeId", "nodeId") REFERENCES public."CompetenceTreeNode"("treeId", id) ON UPDATE CASCADE;

-- FK CONSTRAINT: AdaptivePracticeQuizItemExposure AdaptivePracticeQuizItemExposure_publicationId_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizItemExposure"
    ADD CONSTRAINT "AdaptivePracticeQuizItemExposure_publicationId_fkey" FOREIGN KEY ("publicationId") REFERENCES public."PracticeQuizAdaptivePublication"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptivePracticeQuizItemExposure AdaptivePracticeQuizItemExposure_publicationId_poolItemId_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizItemExposure"
    ADD CONSTRAINT "AdaptivePracticeQuizItemExposure_publicationId_poolItemId_fkey" FOREIGN KEY ("publicationId", "poolItemId") REFERENCES public."PracticeQuizAdaptivePoolItem"("publicationId", id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptivePracticeQuizResponse AdaptivePracticeQuizResponse_assignmentId_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizResponse"
    ADD CONSTRAINT "AdaptivePracticeQuizResponse_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."CompetenceTreeElementAssignment"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizResponse AdaptivePracticeQuizResponse_attemptId_configId_publicatio_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizResponse"
    ADD CONSTRAINT "AdaptivePracticeQuizResponse_attemptId_configId_publicatio_fkey" FOREIGN KEY ("attemptId", "configId", "publicationId") REFERENCES public."AdaptivePracticeQuizAttempt"(id, "configId", "publicationId") ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptivePracticeQuizResponse AdaptivePracticeQuizResponse_publicationId_poolItemId_assi_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizResponse"
    ADD CONSTRAINT "AdaptivePracticeQuizResponse_publicationId_poolItemId_assi_fkey" FOREIGN KEY ("publicationId", "poolItemId", "assignmentId", "elementId") REFERENCES public."PracticeQuizAdaptivePoolItem"("publicationId", id, "sourceAssignmentId", "elementId") ON UPDATE CASCADE;

-- FK CONSTRAINT: CompetenceTreeCourse CompetenceTreeCourse_courseId_fkey
ALTER TABLE ONLY public."CompetenceTreeCourse"
    ADD CONSTRAINT "CompetenceTreeCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES public."Course"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeCourse CompetenceTreeCourse_linkedById_fkey
ALTER TABLE ONLY public."CompetenceTreeCourse"
    ADD CONSTRAINT "CompetenceTreeCourse_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- FK CONSTRAINT: CompetenceTreeCourse CompetenceTreeCourse_treeId_fkey
ALTER TABLE ONLY public."CompetenceTreeCourse"
    ADD CONSTRAINT "CompetenceTreeCourse_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES public."CompetenceTree"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeElementAssignment CompetenceTreeElementAssignment_elementId_fkey
ALTER TABLE ONLY public."CompetenceTreeElementAssignment"
    ADD CONSTRAINT "CompetenceTreeElementAssignment_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES public."Element"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeElementAssignment CompetenceTreeElementAssignment_leafNodeId_fkey
ALTER TABLE ONLY public."CompetenceTreeElementAssignment"
    ADD CONSTRAINT "CompetenceTreeElementAssignment_leafNodeId_fkey" FOREIGN KEY ("leafNodeId") REFERENCES public."CompetenceTreeNode"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeElementAssignment CompetenceTreeElementAssignment_levelId_fkey
ALTER TABLE ONLY public."CompetenceTreeElementAssignment"
    ADD CONSTRAINT "CompetenceTreeElementAssignment_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES public."CompetenceTreeLevel"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeElementAssignment CompetenceTreeElementAssignment_treeId_fkey
ALTER TABLE ONLY public."CompetenceTreeElementAssignment"
    ADD CONSTRAINT "CompetenceTreeElementAssignment_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES public."CompetenceTree"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeLeafLevelCoverage CompetenceTreeLeafLevelCoverage_leafNodeId_fkey
ALTER TABLE ONLY public."CompetenceTreeLeafLevelCoverage"
    ADD CONSTRAINT "CompetenceTreeLeafLevelCoverage_leafNodeId_fkey" FOREIGN KEY ("leafNodeId") REFERENCES public."CompetenceTreeNode"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeLeafLevelCoverage CompetenceTreeLeafLevelCoverage_levelId_fkey
ALTER TABLE ONLY public."CompetenceTreeLeafLevelCoverage"
    ADD CONSTRAINT "CompetenceTreeLeafLevelCoverage_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES public."CompetenceTreeLevel"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeLeafLevelCoverage CompetenceTreeLeafLevelCoverage_treeId_fkey
ALTER TABLE ONLY public."CompetenceTreeLeafLevelCoverage"
    ADD CONSTRAINT "CompetenceTreeLeafLevelCoverage_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES public."CompetenceTree"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeLevel CompetenceTreeLevel_treeId_fkey
ALTER TABLE ONLY public."CompetenceTreeLevel"
    ADD CONSTRAINT "CompetenceTreeLevel_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES public."CompetenceTree"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeNode CompetenceTreeNode_parentId_fkey
ALTER TABLE ONLY public."CompetenceTreeNode"
    ADD CONSTRAINT "CompetenceTreeNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES public."CompetenceTreeNode"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeNode CompetenceTreeNode_treeId_fkey
ALTER TABLE ONLY public."CompetenceTreeNode"
    ADD CONSTRAINT "CompetenceTreeNode_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES public."CompetenceTree"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeScaleApproval CompetenceTreeScaleApproval_reviewerId_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleApproval"
    ADD CONSTRAINT "CompetenceTreeScaleApproval_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeScaleApproval CompetenceTreeScaleApproval_submittedById_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleApproval"
    ADD CONSTRAINT "CompetenceTreeScaleApproval_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- FK CONSTRAINT: CompetenceTreeScaleApproval CompetenceTreeScaleApproval_treeId_scaleVersionId_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleApproval"
    ADD CONSTRAINT "CompetenceTreeScaleApproval_treeId_scaleVersionId_fkey" FOREIGN KEY ("treeId", "scaleVersionId") REFERENCES public."CompetenceTreeScaleVersion"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeScaleLevel CompetenceTreeScaleLevel_treeId_scaleVersionId_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleLevel"
    ADD CONSTRAINT "CompetenceTreeScaleLevel_treeId_scaleVersionId_fkey" FOREIGN KEY ("treeId", "scaleVersionId") REFERENCES public."CompetenceTreeScaleVersion"("treeId", id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeScaleLevel CompetenceTreeScaleLevel_treeId_sourceLevelId_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleLevel"
    ADD CONSTRAINT "CompetenceTreeScaleLevel_treeId_sourceLevelId_fkey" FOREIGN KEY ("treeId", "sourceLevelId") REFERENCES public."CompetenceTreeLevel"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeScaleLinkAnchor CompetenceTreeScaleLinkAnchor_fromCalibrationId_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleLinkAnchor"
    ADD CONSTRAINT "CompetenceTreeScaleLinkAnchor_fromCalibrationId_fkey" FOREIGN KEY ("fromCalibrationId") REFERENCES public."AdaptiveItemCalibration"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeScaleLinkAnchor CompetenceTreeScaleLinkAnchor_scaleLinkId_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleLinkAnchor"
    ADD CONSTRAINT "CompetenceTreeScaleLinkAnchor_scaleLinkId_fkey" FOREIGN KEY ("scaleLinkId") REFERENCES public."CompetenceTreeScaleLink"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeScaleLinkAnchor CompetenceTreeScaleLinkAnchor_toCalibrationId_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleLinkAnchor"
    ADD CONSTRAINT "CompetenceTreeScaleLinkAnchor_toCalibrationId_fkey" FOREIGN KEY ("toCalibrationId") REFERENCES public."AdaptiveItemCalibration"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeScaleLink CompetenceTreeScaleLink_createdById_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleLink"
    ADD CONSTRAINT "CompetenceTreeScaleLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- FK CONSTRAINT: CompetenceTreeScaleLink CompetenceTreeScaleLink_reviewedById_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleLink"
    ADD CONSTRAINT "CompetenceTreeScaleLink_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeScaleLink CompetenceTreeScaleLink_treeId_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleLink"
    ADD CONSTRAINT "CompetenceTreeScaleLink_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES public."CompetenceTree"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeScaleLink CompetenceTreeScaleLink_treeId_fromScaleVersionId_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleLink"
    ADD CONSTRAINT "CompetenceTreeScaleLink_treeId_fromScaleVersionId_fkey" FOREIGN KEY ("treeId", "fromScaleVersionId") REFERENCES public."CompetenceTreeScaleVersion"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeScaleLink CompetenceTreeScaleLink_treeId_toScaleVersionId_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleLink"
    ADD CONSTRAINT "CompetenceTreeScaleLink_treeId_toScaleVersionId_fkey" FOREIGN KEY ("treeId", "toScaleVersionId") REFERENCES public."CompetenceTreeScaleVersion"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeScaleVersion CompetenceTreeScaleVersion_createdById_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleVersion"
    ADD CONSTRAINT "CompetenceTreeScaleVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- FK CONSTRAINT: CompetenceTreeScaleVersion CompetenceTreeScaleVersion_supersedesVersionId_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleVersion"
    ADD CONSTRAINT "CompetenceTreeScaleVersion_supersedesVersionId_fkey" FOREIGN KEY ("supersedesVersionId") REFERENCES public."CompetenceTreeScaleVersion"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeScaleVersion CompetenceTreeScaleVersion_treeId_fkey
ALTER TABLE ONLY public."CompetenceTreeScaleVersion"
    ADD CONSTRAINT "CompetenceTreeScaleVersion_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES public."CompetenceTree"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTree CompetenceTree_ownerId_fkey
ALTER TABLE ONLY public."CompetenceTree"
    ADD CONSTRAINT "CompetenceTree_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptiveConfig PracticeQuizAdaptiveConfig_competenceTreeId_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveConfig"
    ADD CONSTRAINT "PracticeQuizAdaptiveConfig_competenceTreeId_fkey" FOREIGN KEY ("competenceTreeId") REFERENCES public."CompetenceTree"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptiveConfig PracticeQuizAdaptiveConfig_competenceTreeId_scaleVersionId_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveConfig"
    ADD CONSTRAINT "PracticeQuizAdaptiveConfig_competenceTreeId_scaleVersionId_fkey" FOREIGN KEY ("competenceTreeId", "scaleVersionId") REFERENCES public."CompetenceTreeScaleVersion"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptiveConfig PracticeQuizAdaptiveConfig_practiceQuizId_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveConfig"
    ADD CONSTRAINT "PracticeQuizAdaptiveConfig_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES public."PracticeQuiz"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: PracticeQuizAdaptiveElementOverride PracticeQuizAdaptiveElementOverride_assignmentId_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveElementOverride"
    ADD CONSTRAINT "PracticeQuizAdaptiveElementOverride_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES public."CompetenceTreeElementAssignment"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: PracticeQuizAdaptiveElementOverride PracticeQuizAdaptiveElementOverride_configId_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveElementOverride"
    ADD CONSTRAINT "PracticeQuizAdaptiveElementOverride_configId_fkey" FOREIGN KEY ("configId") REFERENCES public."PracticeQuizAdaptiveConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: PracticeQuizAdaptiveNodeOverride PracticeQuizAdaptiveNodeOverride_configId_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveNodeOverride"
    ADD CONSTRAINT "PracticeQuizAdaptiveNodeOverride_configId_fkey" FOREIGN KEY ("configId") REFERENCES public."PracticeQuizAdaptiveConfig"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: PracticeQuizAdaptiveNodeOverride PracticeQuizAdaptiveNodeOverride_nodeId_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveNodeOverride"
    ADD CONSTRAINT "PracticeQuizAdaptiveNodeOverride_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES public."CompetenceTreeNode"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: PracticeQuizAdaptivePoolItem PracticeQuizAdaptivePoolItem_competenceTreeId_scaleVersion_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePoolItem"
    ADD CONSTRAINT "PracticeQuizAdaptivePoolItem_competenceTreeId_scaleVersion_fkey" FOREIGN KEY ("competenceTreeId", "scaleVersionId", "calibrationId", "sourceAssignmentId", "elementId", "elementVersion") REFERENCES public."AdaptiveItemCalibration"("treeId", "scaleVersionId", id, "assignmentId", "elementId", "elementVersion") ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptivePoolItem PracticeQuizAdaptivePoolItem_configId_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePoolItem"
    ADD CONSTRAINT "PracticeQuizAdaptivePoolItem_configId_fkey" FOREIGN KEY ("configId") REFERENCES public."PracticeQuizAdaptiveConfig"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptivePoolItem PracticeQuizAdaptivePoolItem_publicationId_configId_compet_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePoolItem"
    ADD CONSTRAINT "PracticeQuizAdaptivePoolItem_publicationId_configId_compet_fkey" FOREIGN KEY ("publicationId", "configId", "competenceTreeId") REFERENCES public."PracticeQuizAdaptivePublication"(id, "configId", "competenceTreeId") ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptivePoolItem PracticeQuizAdaptivePoolItem_sourceAssignmentId_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePoolItem"
    ADD CONSTRAINT "PracticeQuizAdaptivePoolItem_sourceAssignmentId_fkey" FOREIGN KEY ("sourceAssignmentId") REFERENCES public."CompetenceTreeElementAssignment"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptivePublication PracticeQuizAdaptivePublication_competenceTreeId_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePublication"
    ADD CONSTRAINT "PracticeQuizAdaptivePublication_competenceTreeId_fkey" FOREIGN KEY ("competenceTreeId") REFERENCES public."CompetenceTree"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptivePublication PracticeQuizAdaptivePublication_configId_competenceTreeId_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePublication"
    ADD CONSTRAINT "PracticeQuizAdaptivePublication_configId_competenceTreeId_fkey" FOREIGN KEY ("configId", "competenceTreeId") REFERENCES public."PracticeQuizAdaptiveConfig"(id, "competenceTreeId") ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptivePublication PracticeQuizAdaptivePublication_empiricalValidationId_conf_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePublication"
    ADD CONSTRAINT "PracticeQuizAdaptivePublication_empiricalValidationId_conf_fkey" FOREIGN KEY ("empiricalValidationId", "configId", "competenceTreeId", "scaleVersionId", "measurementVersion", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion") REFERENCES public."AdaptivePracticeQuizEmpiricalValidation"(id, "configId", "competenceTreeId", "scaleVersionId", "measurementVersion", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion") ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptivePublication PracticeQuizAdaptivePublication_publishedById_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePublication"
    ADD CONSTRAINT "PracticeQuizAdaptivePublication_publishedById_fkey" FOREIGN KEY ("publishedById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;

-- FK CONSTRAINT: _AdditionalAssignmentLeaves _AdditionalAssignmentLeaves_A_fkey
ALTER TABLE ONLY public."_AdditionalAssignmentLeaves"
    ADD CONSTRAINT "_AdditionalAssignmentLeaves_A_fkey" FOREIGN KEY ("A") REFERENCES public."CompetenceTreeElementAssignment"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: _AdditionalAssignmentLeaves _AdditionalAssignmentLeaves_B_fkey
ALTER TABLE ONLY public."_AdditionalAssignmentLeaves"
    ADD CONSTRAINT "_AdditionalAssignmentLeaves_B_fkey" FOREIGN KEY ("B") REFERENCES public."CompetenceTreeNode"(id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: AdaptiveItemCalibration aic_assignment_element_identity_fkey
ALTER TABLE ONLY public."AdaptiveItemCalibration"
    ADD CONSTRAINT aic_assignment_element_identity_fkey FOREIGN KEY ("treeId", "assignmentId", "elementId") REFERENCES public."CompetenceTreeElementAssignment"("treeId", id, "elementId") ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizAttempt apqa_final_scale_level_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizAttempt"
    ADD CONSTRAINT apqa_final_scale_level_fkey FOREIGN KEY ("competenceTreeId", "scaleVersionId", "finalScaleLevelId") REFERENCES public."CompetenceTreeScaleLevel"("treeId", "scaleVersionId", id) ON UPDATE CASCADE;

-- FK CONSTRAINT: AdaptivePracticeQuizAttempt apqa_publication_dispatch_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizAttempt"
    ADD CONSTRAINT apqa_publication_dispatch_fkey FOREIGN KEY ("publicationId", "configId", "competenceTreeId", "scaleVersionId", "measurementVersion", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion") REFERENCES public."PracticeQuizAdaptivePublication"(id, "configId", "competenceTreeId", "scaleVersionId", "measurementVersion", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion") ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizAttempt apqa_scale_version_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizAttempt"
    ADD CONSTRAINT apqa_scale_version_fkey FOREIGN KEY ("competenceTreeId", "scaleVersionId") REFERENCES public."CompetenceTreeScaleVersion"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: AdaptivePracticeQuizEmpiricalValidation apqev_scale_version_fkey
ALTER TABLE ONLY public."AdaptivePracticeQuizEmpiricalValidation"
    ADD CONSTRAINT apqev_scale_version_fkey FOREIGN KEY ("competenceTreeId", "scaleVersionId") REFERENCES public."CompetenceTreeScaleVersion"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeElementAssignment ctea_leaf_same_tree_fkey
ALTER TABLE ONLY public."CompetenceTreeElementAssignment"
    ADD CONSTRAINT ctea_leaf_same_tree_fkey FOREIGN KEY ("treeId", "leafNodeId") REFERENCES public."CompetenceTreeNode"("treeId", id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeElementAssignment ctea_level_same_tree_fkey
ALTER TABLE ONLY public."CompetenceTreeElementAssignment"
    ADD CONSTRAINT ctea_level_same_tree_fkey FOREIGN KEY ("treeId", "levelId") REFERENCES public."CompetenceTreeLevel"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: CompetenceTreeLeafLevelCoverage ctlc_leaf_same_tree_fkey
ALTER TABLE ONLY public."CompetenceTreeLeafLevelCoverage"
    ADD CONSTRAINT ctlc_leaf_same_tree_fkey FOREIGN KEY ("treeId", "leafNodeId") REFERENCES public."CompetenceTreeNode"("treeId", id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeLeafLevelCoverage ctlc_level_same_tree_fkey
ALTER TABLE ONLY public."CompetenceTreeLeafLevelCoverage"
    ADD CONSTRAINT ctlc_level_same_tree_fkey FOREIGN KEY ("treeId", "levelId") REFERENCES public."CompetenceTreeLevel"("treeId", id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: CompetenceTreeNode ctn_parent_same_tree_fkey
ALTER TABLE ONLY public."CompetenceTreeNode"
    ADD CONSTRAINT ctn_parent_same_tree_fkey FOREIGN KEY ("treeId", "parentId") REFERENCES public."CompetenceTreeNode"("treeId", id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: PracticeQuizAdaptiveElementOverride pqae_assignment_same_tree_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveElementOverride"
    ADD CONSTRAINT pqae_assignment_same_tree_fkey FOREIGN KEY ("competenceTreeId", "assignmentId") REFERENCES public."CompetenceTreeElementAssignment"("treeId", id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: PracticeQuizAdaptiveElementOverride pqae_config_tree_same_tree_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveElementOverride"
    ADD CONSTRAINT pqae_config_tree_same_tree_fkey FOREIGN KEY ("configId", "competenceTreeId") REFERENCES public."PracticeQuizAdaptiveConfig"(id, "competenceTreeId") ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: PracticeQuizAdaptiveNodeOverride pqan_config_tree_same_tree_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveNodeOverride"
    ADD CONSTRAINT pqan_config_tree_same_tree_fkey FOREIGN KEY ("configId", "competenceTreeId") REFERENCES public."PracticeQuizAdaptiveConfig"(id, "competenceTreeId") ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: PracticeQuizAdaptiveNodeOverride pqan_node_same_tree_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptiveNodeOverride"
    ADD CONSTRAINT pqan_node_same_tree_fkey FOREIGN KEY ("competenceTreeId", "nodeId") REFERENCES public."CompetenceTreeNode"("treeId", id) ON UPDATE CASCADE ON DELETE CASCADE;

-- FK CONSTRAINT: PracticeQuizAdaptivePublication pqap_scale_version_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePublication"
    ADD CONSTRAINT pqap_scale_version_fkey FOREIGN KEY ("competenceTreeId", "scaleVersionId") REFERENCES public."CompetenceTreeScaleVersion"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptivePoolItem pqapi_assignment_same_tree_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePoolItem"
    ADD CONSTRAINT pqapi_assignment_same_tree_fkey FOREIGN KEY ("competenceTreeId", "sourceAssignmentId") REFERENCES public."CompetenceTreeElementAssignment"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptivePoolItem pqapi_config_tree_same_tree_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePoolItem"
    ADD CONSTRAINT pqapi_config_tree_same_tree_fkey FOREIGN KEY ("configId", "competenceTreeId") REFERENCES public."PracticeQuizAdaptiveConfig"(id, "competenceTreeId") ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptivePoolItem pqapi_leaf_same_tree_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePoolItem"
    ADD CONSTRAINT pqapi_leaf_same_tree_fkey FOREIGN KEY ("competenceTreeId", "leafNodeId") REFERENCES public."CompetenceTreeNode"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

-- FK CONSTRAINT: PracticeQuizAdaptivePoolItem pqapi_level_same_tree_fkey
ALTER TABLE ONLY public."PracticeQuizAdaptivePoolItem"
    ADD CONSTRAINT pqapi_level_same_tree_fkey FOREIGN KEY ("competenceTreeId", "levelId") REFERENCES public."CompetenceTreeLevel"("treeId", id) ON UPDATE CASCADE ON DELETE RESTRICT;

COMMIT;
