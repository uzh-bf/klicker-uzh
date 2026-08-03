-- Contract the adaptive-learning schema after every legacy identity is materialized.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '10min';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "PracticeQuizAdaptivePoolItem"
    WHERE "publicationId" IS NULL
       OR "scaleVersionId" IS NULL
       OR "calibrationId" IS NULL
       OR "measurementVersion" IS NULL
       OR "calibrationVersion" IS NULL
       OR "calibrationStatus" IS NULL
       OR "itemModel" IS NULL
       OR "modelImplementationVersion" IS NULL
  ) THEN
    RAISE EXCEPTION 'Adaptive IRT v2 contract found an unversioned publication-pool row';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "AdaptivePracticeQuizAttempt"
    WHERE "publicationId" IS NULL
       OR "scaleVersionId" IS NULL
       OR "measurementVersion" IS NULL
       OR "estimatorImplementationVersion" IS NULL
       OR "classificationPolicyVersion" IS NULL
       OR "calibrationPolicyVersion" IS NULL
  ) THEN
    RAISE EXCEPTION 'Adaptive IRT v2 contract found an unversioned attempt';
  END IF;

  IF EXISTS (SELECT 1 FROM "AdaptivePracticeQuizResponse" WHERE "publicationId" IS NULL) THEN
    RAISE EXCEPTION 'Adaptive IRT v2 contract found an unversioned response';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "PracticeQuizAdaptivePoolItem" pool
    JOIN "PracticeQuizAdaptivePublication" publication ON publication.id = pool."publicationId"
    JOIN "AdaptiveItemCalibration" calibration ON calibration.id = pool."calibrationId"
    WHERE publication."configId" <> pool."configId"
       OR publication."competenceTreeId" <> pool."competenceTreeId"
       OR publication."scaleVersionId" <> pool."scaleVersionId"
       OR calibration."treeId" <> pool."competenceTreeId"
       OR calibration."scaleVersionId" <> pool."scaleVersionId"
       OR calibration."assignmentId" <> pool."sourceAssignmentId"
       OR calibration."elementId" <> pool."elementId"
       OR calibration."elementVersion" <> pool."elementVersion"
  ) THEN
    RAISE EXCEPTION 'Adaptive IRT v2 contract found inconsistent pool publication or calibration identity';
  END IF;
END $$;

ALTER TABLE "PracticeQuizAdaptivePoolItem"
  ALTER COLUMN "publicationId" SET NOT NULL,
  ALTER COLUMN "scaleVersionId" SET NOT NULL,
  ALTER COLUMN "calibrationId" SET NOT NULL,
  ALTER COLUMN "measurementVersion" SET NOT NULL,
  ALTER COLUMN "calibrationVersion" SET NOT NULL,
  ALTER COLUMN "calibrationStatus" SET NOT NULL,
  ALTER COLUMN "itemModel" SET NOT NULL,
  ALTER COLUMN "modelImplementationVersion" SET NOT NULL;

ALTER TABLE "AdaptivePracticeQuizAttempt"
  ALTER COLUMN "publicationId" SET NOT NULL,
  ALTER COLUMN "scaleVersionId" SET NOT NULL,
  ALTER COLUMN "measurementVersion" SET NOT NULL,
  ALTER COLUMN "estimatorImplementationVersion" SET NOT NULL,
  ALTER COLUMN "classificationPolicyVersion" SET NOT NULL,
  ALTER COLUMN "calibrationPolicyVersion" SET NOT NULL;

ALTER TABLE "AdaptivePracticeQuizResponse"
  ALTER COLUMN "publicationId" SET NOT NULL;

DROP INDEX "pqapi_config_assignment_key";
DROP INDEX "pqapi_config_leaf_level_idx";
DROP INDEX "pqapi_tree_assignment_idx";

ALTER TABLE "PracticeQuizAdaptivePoolItem"
  DROP CONSTRAINT "PracticeQuizAdaptivePoolItem_configId_fkey",
  DROP CONSTRAINT "pqapi_config_tree_same_tree_fkey";

ALTER TABLE "PracticeQuizAdaptivePoolItem"
  ADD CONSTRAINT "PracticeQuizAdaptivePoolItem_configId_fkey"
  FOREIGN KEY ("configId") REFERENCES "PracticeQuizAdaptiveConfig"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "PracticeQuizAdaptivePoolItem"
  ADD CONSTRAINT "pqapi_config_tree_same_tree_fkey"
  FOREIGN KEY ("configId", "competenceTreeId") REFERENCES "PracticeQuizAdaptiveConfig"("id", "competenceTreeId")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "AdaptivePracticeQuizAttempt"
  DROP CONSTRAINT "AdaptivePracticeQuizAttempt_configId_nextPoolItemId_fkey";

ALTER TABLE "AdaptivePracticeQuizResponse"
  DROP CONSTRAINT "AdaptivePracticeQuizResponse_attemptId_configId_fkey",
  DROP CONSTRAINT "AdaptivePracticeQuizResponse_configId_poolItemId_assignmentId_e";

ALTER TABLE "CompetenceTreeScaleVersion"
  ADD CONSTRAINT "CompetenceTreeScaleVersion_treeId_fkey"
    FOREIGN KEY ("treeId") REFERENCES "CompetenceTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "CompetenceTreeScaleVersion_supersedesVersionId_fkey"
    FOREIGN KEY ("supersedesVersionId") REFERENCES "CompetenceTreeScaleVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "CompetenceTreeScaleVersion_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

ALTER TABLE "CompetenceTreeScaleLevel"
  ADD CONSTRAINT "CompetenceTreeScaleLevel_treeId_scaleVersionId_fkey"
    FOREIGN KEY ("treeId", "scaleVersionId") REFERENCES "CompetenceTreeScaleVersion"("treeId", "id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "CompetenceTreeScaleLevel_treeId_sourceLevelId_fkey"
    FOREIGN KEY ("treeId", "sourceLevelId") REFERENCES "CompetenceTreeLevel"("treeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "CompetenceTreeScaleApproval"
  ADD CONSTRAINT "CompetenceTreeScaleApproval_treeId_scaleVersionId_fkey"
    FOREIGN KEY ("treeId", "scaleVersionId") REFERENCES "CompetenceTreeScaleVersion"("treeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "CompetenceTreeScaleApproval_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "CompetenceTreeScaleApproval_reviewerId_fkey"
    FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "CompetenceTreeScaleLink"
  ADD CONSTRAINT "CompetenceTreeScaleLink_treeId_fkey"
    FOREIGN KEY ("treeId") REFERENCES "CompetenceTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "CompetenceTreeScaleLink_treeId_fromScaleVersionId_fkey"
    FOREIGN KEY ("treeId", "fromScaleVersionId") REFERENCES "CompetenceTreeScaleVersion"("treeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "CompetenceTreeScaleLink_treeId_toScaleVersionId_fkey"
    FOREIGN KEY ("treeId", "toScaleVersionId") REFERENCES "CompetenceTreeScaleVersion"("treeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "CompetenceTreeScaleLink_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "CompetenceTreeScaleLink_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "CompetenceTreeScaleLinkAnchor"
  ADD CONSTRAINT "CompetenceTreeScaleLinkAnchor_scaleLinkId_fkey"
    FOREIGN KEY ("scaleLinkId") REFERENCES "CompetenceTreeScaleLink"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "CompetenceTreeScaleLinkAnchor_fromCalibrationId_fkey"
    FOREIGN KEY ("fromCalibrationId") REFERENCES "AdaptiveItemCalibration"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "CompetenceTreeScaleLinkAnchor_toCalibrationId_fkey"
    FOREIGN KEY ("toCalibrationId") REFERENCES "AdaptiveItemCalibration"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "AdaptiveItemCalibration"
  ADD CONSTRAINT "AdaptiveItemCalibration_treeId_fkey"
    FOREIGN KEY ("treeId") REFERENCES "CompetenceTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptiveItemCalibration_treeId_scaleVersionId_fkey"
    FOREIGN KEY ("treeId", "scaleVersionId") REFERENCES "CompetenceTreeScaleVersion"("treeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptiveItemCalibration_treeId_assignmentId_fkey"
    FOREIGN KEY ("treeId", "assignmentId") REFERENCES "CompetenceTreeElementAssignment"("treeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "aic_assignment_element_identity_fkey"
    FOREIGN KEY ("treeId", "assignmentId", "elementId") REFERENCES "CompetenceTreeElementAssignment"("treeId", "id", "elementId") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptiveItemCalibration_elementId_fkey"
    FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptiveItemCalibration_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptiveItemCalibration_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "PracticeQuizAdaptiveConfig"
  ADD CONSTRAINT "PracticeQuizAdaptiveConfig_competenceTreeId_scaleVersionId_fkey"
  FOREIGN KEY ("competenceTreeId", "scaleVersionId") REFERENCES "CompetenceTreeScaleVersion"("treeId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "PracticeQuizAdaptivePublication"
  ADD CONSTRAINT "PracticeQuizAdaptivePublication_configId_competenceTreeId_fkey"
    FOREIGN KEY ("configId", "competenceTreeId") REFERENCES "PracticeQuizAdaptiveConfig"("id", "competenceTreeId") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "PracticeQuizAdaptivePublication_competenceTreeId_fkey"
    FOREIGN KEY ("competenceTreeId") REFERENCES "CompetenceTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "pqap_scale_version_fkey"
    FOREIGN KEY ("competenceTreeId", "scaleVersionId") REFERENCES "CompetenceTreeScaleVersion"("treeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "PracticeQuizAdaptivePublication_empiricalValidationId_conf_fkey"
    FOREIGN KEY ("empiricalValidationId", "configId", "competenceTreeId", "scaleVersionId", "measurementVersion", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion")
    REFERENCES "AdaptivePracticeQuizEmpiricalValidation"("id", "configId", "competenceTreeId", "scaleVersionId", "measurementVersion", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion")
    ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "PracticeQuizAdaptivePublication_publishedById_fkey"
    FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

ALTER TABLE "AdaptivePracticeQuizCohortSnapshot"
  ALTER COLUMN "publicationId" SET NOT NULL,
  ALTER COLUMN "scaleVersionId" SET NOT NULL,
  ALTER COLUMN "measurementVersion" SET NOT NULL,
  ADD CONSTRAINT "AdaptivePracticeQuizCohortSnapshot_publication_fkey"
    FOREIGN KEY ("publicationId", "scaleVersionId", "measurementVersion")
    REFERENCES "PracticeQuizAdaptivePublication"("id", "scaleVersionId", "measurementVersion")
    ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "AdaptivePracticeQuizCohortSnapshot"
  DROP CONSTRAINT "apqcs_aggregate_schema_check",
  ADD CONSTRAINT "apqcs_aggregate_schema_check" CHECK (
    jsonb_typeof("aggregate") = 'object'
    AND "aggregate" ->> 'schemaVersion' IN ('1', '2')
  );

ALTER TABLE "AdaptiveCalibrationExportRequest"
  ADD CONSTRAINT "AdaptiveCalibrationExportRequest_treeId_fkey"
    FOREIGN KEY ("treeId") REFERENCES "CompetenceTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptiveCalibrationExportRequest_treeId_scaleVersionId_fkey"
    FOREIGN KEY ("treeId", "scaleVersionId") REFERENCES "CompetenceTreeScaleVersion"("treeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptiveCalibrationExportRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;

ALTER TABLE "AdaptivePracticeQuizEmpiricalValidation"
  ADD CONSTRAINT "AdaptivePracticeQuizEmpiricalValidation_configId_competenc_fkey"
    FOREIGN KEY ("configId", "competenceTreeId") REFERENCES "PracticeQuizAdaptiveConfig"("id", "competenceTreeId") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptivePracticeQuizEmpiricalValidation_competenceTreeId_fkey"
    FOREIGN KEY ("competenceTreeId") REFERENCES "CompetenceTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "apqev_scale_version_fkey"
    FOREIGN KEY ("competenceTreeId", "scaleVersionId") REFERENCES "CompetenceTreeScaleVersion"("treeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptivePracticeQuizEmpiricalValidation_exportRequestId_fkey"
    FOREIGN KEY ("exportRequestId") REFERENCES "AdaptiveCalibrationExportRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptivePracticeQuizEmpiricalValidation_submittedById_fkey"
    FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptivePracticeQuizEmpiricalValidation_approvedById_fkey"
    FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "AdaptivePracticeQuizItemExposure"
  ADD CONSTRAINT "AdaptivePracticeQuizItemExposure_publicationId_fkey"
    FOREIGN KEY ("publicationId") REFERENCES "PracticeQuizAdaptivePublication"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptivePracticeQuizItemExposure_publicationId_poolItemId_fkey"
    FOREIGN KEY ("publicationId", "poolItemId") REFERENCES "PracticeQuizAdaptivePoolItem"("publicationId", "id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;

ALTER TABLE "PracticeQuizAdaptivePoolItem"
  ADD CONSTRAINT "PracticeQuizAdaptivePoolItem_publicationId_configId_compet_fkey"
    FOREIGN KEY ("publicationId", "configId", "competenceTreeId") REFERENCES "PracticeQuizAdaptivePublication"("id", "configId", "competenceTreeId") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "PracticeQuizAdaptivePoolItem_competenceTreeId_scaleVersion_fkey"
    FOREIGN KEY ("competenceTreeId", "scaleVersionId", "calibrationId", "sourceAssignmentId", "elementId", "elementVersion") REFERENCES "AdaptiveItemCalibration"("treeId", "scaleVersionId", "id", "assignmentId", "elementId", "elementVersion") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;

ALTER TABLE "AdaptivePracticeQuizAttempt"
  ADD CONSTRAINT "apqa_publication_dispatch_fkey"
    FOREIGN KEY ("publicationId", "configId", "competenceTreeId", "scaleVersionId", "measurementVersion", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion")
    REFERENCES "PracticeQuizAdaptivePublication"("id", "configId", "competenceTreeId", "scaleVersionId", "measurementVersion", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "apqa_scale_version_fkey"
    FOREIGN KEY ("competenceTreeId", "scaleVersionId") REFERENCES "CompetenceTreeScaleVersion"("treeId", "id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "apqa_final_scale_level_fkey"
    FOREIGN KEY ("competenceTreeId", "scaleVersionId", "finalScaleLevelId") REFERENCES "CompetenceTreeScaleLevel"("treeId", "scaleVersionId", "id") ON DELETE NO ACTION ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptivePracticeQuizAttempt_publicationId_nextPoolItemId_fkey"
    FOREIGN KEY ("publicationId", "nextPoolItemId") REFERENCES "PracticeQuizAdaptivePoolItem"("publicationId", "id") ON DELETE NO ACTION ON UPDATE CASCADE NOT VALID;

ALTER TABLE "AdaptivePracticeQuizResponse"
  ADD CONSTRAINT "AdaptivePracticeQuizResponse_attemptId_configId_publicatio_fkey"
    FOREIGN KEY ("attemptId", "configId", "publicationId") REFERENCES "AdaptivePracticeQuizAttempt"("id", "configId", "publicationId") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID,
  ADD CONSTRAINT "AdaptivePracticeQuizResponse_publicationId_poolItemId_assi_fkey"
    FOREIGN KEY ("publicationId", "poolItemId", "assignmentId", "elementId") REFERENCES "PracticeQuizAdaptivePoolItem"("publicationId", "id", "sourceAssignmentId", "elementId") ON DELETE NO ACTION ON UPDATE CASCADE NOT VALID;

DO $$
DECLARE
  item record;
BEGIN
  FOR item IN
    SELECT * FROM (VALUES
      ('"PracticeQuizAdaptivePoolItem"', 'PracticeQuizAdaptivePoolItem_configId_fkey'),
      ('"PracticeQuizAdaptivePoolItem"', 'pqapi_config_tree_same_tree_fkey'),
      ('"CompetenceTreeScaleVersion"', 'CompetenceTreeScaleVersion_treeId_fkey'),
      ('"CompetenceTreeScaleVersion"', 'CompetenceTreeScaleVersion_supersedesVersionId_fkey'),
      ('"CompetenceTreeScaleVersion"', 'CompetenceTreeScaleVersion_createdById_fkey'),
      ('"CompetenceTreeScaleLevel"', 'CompetenceTreeScaleLevel_treeId_scaleVersionId_fkey'),
      ('"CompetenceTreeScaleLevel"', 'CompetenceTreeScaleLevel_treeId_sourceLevelId_fkey'),
      ('"CompetenceTreeScaleApproval"', 'CompetenceTreeScaleApproval_treeId_scaleVersionId_fkey'),
      ('"CompetenceTreeScaleApproval"', 'CompetenceTreeScaleApproval_submittedById_fkey'),
      ('"CompetenceTreeScaleApproval"', 'CompetenceTreeScaleApproval_reviewerId_fkey'),
      ('"CompetenceTreeScaleLink"', 'CompetenceTreeScaleLink_treeId_fkey'),
      ('"CompetenceTreeScaleLink"', 'CompetenceTreeScaleLink_treeId_fromScaleVersionId_fkey'),
      ('"CompetenceTreeScaleLink"', 'CompetenceTreeScaleLink_treeId_toScaleVersionId_fkey'),
      ('"CompetenceTreeScaleLink"', 'CompetenceTreeScaleLink_createdById_fkey'),
      ('"CompetenceTreeScaleLink"', 'CompetenceTreeScaleLink_reviewedById_fkey'),
      ('"CompetenceTreeScaleLinkAnchor"', 'CompetenceTreeScaleLinkAnchor_scaleLinkId_fkey'),
      ('"CompetenceTreeScaleLinkAnchor"', 'CompetenceTreeScaleLinkAnchor_fromCalibrationId_fkey'),
      ('"CompetenceTreeScaleLinkAnchor"', 'CompetenceTreeScaleLinkAnchor_toCalibrationId_fkey'),
      ('"AdaptiveItemCalibration"', 'AdaptiveItemCalibration_treeId_fkey'),
      ('"AdaptiveItemCalibration"', 'AdaptiveItemCalibration_treeId_scaleVersionId_fkey'),
      ('"AdaptiveItemCalibration"', 'AdaptiveItemCalibration_treeId_assignmentId_fkey'),
      ('"AdaptiveItemCalibration"', 'aic_assignment_element_identity_fkey'),
      ('"AdaptiveItemCalibration"', 'AdaptiveItemCalibration_elementId_fkey'),
      ('"AdaptiveItemCalibration"', 'AdaptiveItemCalibration_createdById_fkey'),
      ('"AdaptiveItemCalibration"', 'AdaptiveItemCalibration_approvedById_fkey'),
      ('"PracticeQuizAdaptiveConfig"', 'PracticeQuizAdaptiveConfig_competenceTreeId_scaleVersionId_fkey'),
      ('"PracticeQuizAdaptivePublication"', 'PracticeQuizAdaptivePublication_configId_competenceTreeId_fkey'),
      ('"PracticeQuizAdaptivePublication"', 'PracticeQuizAdaptivePublication_competenceTreeId_fkey'),
      ('"PracticeQuizAdaptivePublication"', 'pqap_scale_version_fkey'),
      ('"PracticeQuizAdaptivePublication"', 'PracticeQuizAdaptivePublication_empiricalValidationId_conf_fkey'),
      ('"PracticeQuizAdaptivePublication"', 'PracticeQuizAdaptivePublication_publishedById_fkey'),
      ('"AdaptivePracticeQuizCohortSnapshot"', 'AdaptivePracticeQuizCohortSnapshot_publication_fkey'),
      ('"AdaptiveCalibrationExportRequest"', 'AdaptiveCalibrationExportRequest_treeId_fkey'),
      ('"AdaptiveCalibrationExportRequest"', 'AdaptiveCalibrationExportRequest_treeId_scaleVersionId_fkey'),
      ('"AdaptiveCalibrationExportRequest"', 'AdaptiveCalibrationExportRequest_requestedById_fkey'),
      ('"AdaptivePracticeQuizEmpiricalValidation"', 'AdaptivePracticeQuizEmpiricalValidation_configId_competenc_fkey'),
      ('"AdaptivePracticeQuizEmpiricalValidation"', 'AdaptivePracticeQuizEmpiricalValidation_competenceTreeId_fkey'),
      ('"AdaptivePracticeQuizEmpiricalValidation"', 'apqev_scale_version_fkey'),
      ('"AdaptivePracticeQuizEmpiricalValidation"', 'AdaptivePracticeQuizEmpiricalValidation_exportRequestId_fkey'),
      ('"AdaptivePracticeQuizEmpiricalValidation"', 'AdaptivePracticeQuizEmpiricalValidation_submittedById_fkey'),
      ('"AdaptivePracticeQuizEmpiricalValidation"', 'AdaptivePracticeQuizEmpiricalValidation_approvedById_fkey'),
      ('"AdaptivePracticeQuizItemExposure"', 'AdaptivePracticeQuizItemExposure_publicationId_fkey'),
      ('"AdaptivePracticeQuizItemExposure"', 'AdaptivePracticeQuizItemExposure_publicationId_poolItemId_fkey'),
      ('"PracticeQuizAdaptivePoolItem"', 'PracticeQuizAdaptivePoolItem_publicationId_configId_compet_fkey'),
      ('"PracticeQuizAdaptivePoolItem"', 'PracticeQuizAdaptivePoolItem_competenceTreeId_scaleVersion_fkey'),
      ('"AdaptivePracticeQuizAttempt"', 'apqa_publication_dispatch_fkey'),
      ('"AdaptivePracticeQuizAttempt"', 'apqa_scale_version_fkey'),
      ('"AdaptivePracticeQuizAttempt"', 'apqa_final_scale_level_fkey'),
      ('"AdaptivePracticeQuizAttempt"', 'AdaptivePracticeQuizAttempt_publicationId_nextPoolItemId_fkey'),
      ('"AdaptivePracticeQuizResponse"', 'AdaptivePracticeQuizResponse_attemptId_configId_publicatio_fkey'),
      ('"AdaptivePracticeQuizResponse"', 'AdaptivePracticeQuizResponse_publicationId_poolItemId_assi_fkey')
    ) AS expected(table_name, conname)
  LOOP
    EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', item.table_name, item.conname);
  END LOOP;
END $$;

ALTER TABLE "CompetenceTreeScaleVersion"
  ADD CONSTRAINT "ctsv_numeric_check" CHECK (
    "version" > 0
    AND "classificationPolicyVersion" > 0
    AND "priorMean"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "priorStandardDeviation"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "priorStandardDeviation" > 0
    AND "gridMin"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "gridMax"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "gridStep"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "gridMin" < "gridMax"
    AND "gridStep" > 0
  ) NOT VALID;

ALTER TABLE "CompetenceTreeScaleLevel"
  ADD CONSTRAINT "ctsl_numeric_check" CHECK (
    "order" >= 0
    AND ("lowerBound" IS NULL OR "lowerBound"::text NOT IN ('NaN', 'Infinity', '-Infinity'))
    AND "itemDifficultyPrior"::text NOT IN ('NaN', 'Infinity', '-Infinity')
  ) NOT VALID;

ALTER TABLE "CompetenceTreeScaleApproval"
  ADD CONSTRAINT "ctsa_evidence_check" CHECK (
    "panelSize" > 0
    AND ("decision" IS NULL OR "decision" IN ('APPROVED'::"AdaptiveScaleVersionStatus", 'REJECTED'::"AdaptiveScaleVersionStatus"))
    AND ("decision" IS NULL) = ("reviewerId" IS NULL)
    AND ("decision" IS NULL) = ("reviewedAt" IS NULL)
    AND length("method") > 0
    AND length("methodVersion") > 0
    AND length("artifactChecksum") > 0
    AND length("artifactKey") > 0
  ) NOT VALID;

ALTER TABLE "CompetenceTreeScaleLink"
  ADD CONSTRAINT "ctslk_versions_check" CHECK (
    "fromScaleVersionId" <> "toScaleVersionId"
    AND ("reviewedById" IS NULL) = ("reviewedAt" IS NULL)
  ) NOT VALID;

ALTER TABLE "CompetenceTreeScaleLinkAnchor"
  ADD CONSTRAINT "ctsla_order_check" CHECK ("order" >= 0) NOT VALID;

ALTER TABLE "AdaptiveItemCalibration"
  ADD CONSTRAINT "aic_parameters_check" CHECK (
    "version" > 0
    AND "elementVersion" > 0
    AND "discrimination"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "difficulty"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "guessing"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "discrimination" > 0
    AND "guessing" >= 0
    AND "guessing" < 1
    AND "responseCount" >= 0
    AND "participantCount" >= 0
    AND ("approvedById" IS NULL) = ("approvedAt" IS NULL)
    AND (
      "status" <> 'CALIBRATED'::"AdaptiveItemCalibrationStatus"
      OR ("approvedById" IS NOT NULL AND "approvedAt" IS NOT NULL)
    )
  ) NOT VALID;

ALTER TABLE "PracticeQuizAdaptivePublication"
  ADD CONSTRAINT "pqap_policy_check" CHECK (
    "version" > 0
    AND "classificationPolicyVersion" > 0
    AND "calibrationPolicyVersion" > 0
    AND "rolloutPolicyVersion" > 0
    AND "priorMean"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "priorStandardDeviation"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "priorStandardDeviation" > 0
    AND "gridMin"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "gridMax"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "gridStep"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "gridMin" < "gridMax"
    AND "gridStep" > 0
    AND "totalQuestionCap" > 0
    AND "retakeCooldownDays" >= 0
    AND "exposureCeiling"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "exposureCeiling" > 0
    AND "exposureCeiling" <= 1
    AND (
      ("measurementVersion" = 'IRT_V1'::"AdaptiveMeasurementVersion" AND "classificationProbabilityThreshold" IS NULL)
      OR (
        "measurementVersion" = 'IRT_V2_EAP_GRID_1'::"AdaptiveMeasurementVersion"
        AND "classificationProbabilityThreshold" >= 0.8
        AND "classificationProbabilityThreshold" < 1
        AND "classificationProbabilityThreshold"::text NOT IN ('NaN', 'Infinity', '-Infinity')
      )
    )
  ) NOT VALID;

ALTER TABLE "PracticeQuizAdaptivePublication"
  ADD CONSTRAINT "pqap_lifecycle_timestamps_check" CHECK (
    ("sealedAt" IS NULL OR "sealedAt" >= "publishedAt")
    AND ("supersededAt" IS NULL OR ("sealedAt" IS NOT NULL AND "supersededAt" >= "sealedAt"))
    AND ("unpublishedAt" IS NULL OR ("sealedAt" IS NOT NULL AND "unpublishedAt" >= "sealedAt"))
  ) NOT VALID;

ALTER TABLE "AdaptiveCalibrationExportRequest"
  ADD CONSTRAINT "acer_state_check" CHECK (
    ("rowCount" IS NULL OR "rowCount" >= 0)
    AND "expiresAt" > "createdAt"
    AND ("status" <> 'READY'::"AdaptiveCalibrationExportStatus" OR ("artifactKey" IS NOT NULL AND "artifactChecksum" IS NOT NULL AND "rowCount" IS NOT NULL AND "completedAt" IS NOT NULL))
    AND ("status" <> 'FAILED'::"AdaptiveCalibrationExportStatus" OR ("failureCode" IS NOT NULL AND "completedAt" IS NOT NULL))
  ) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizEmpiricalValidation"
  ADD CONSTRAINT "apqev_evidence_check" CHECK (
    "classificationPolicyVersion" > 0
    AND "calibrationPolicyVersion" > 0
    AND length("validationProtocolVersion") BETWEEN 1 AND 160
    AND "criterionArtifactChecksum" ~ '^[a-f0-9]{64}$'
    AND "approvedProbabilityThreshold"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "approvedProbabilityThreshold" >= 0.8
    AND "approvedProbabilityThreshold" < 1
    AND "calibrationDatasetVersion" <> "holdoutDatasetVersion"
    AND "calibrationDatasetChecksum" <> "holdoutDatasetChecksum"
    AND (
      (
        "status" = 'SUBMITTED'::"AdaptiveEmpiricalValidationStatus"
        AND "approvedById" IS NULL
        AND "reviewedAt" IS NULL
      )
      OR (
        "status" = 'REJECTED'::"AdaptiveEmpiricalValidationStatus"
        AND (("approvedById" IS NULL) = ("reviewedAt" IS NULL))
      )
      OR (
        "status" IN (
          'APPROVED'::"AdaptiveEmpiricalValidationStatus",
          'SUPERSEDED'::"AdaptiveEmpiricalValidationStatus"
        )
        AND "approvedById" IS NOT NULL
        AND "reviewedAt" IS NOT NULL
      )
    )
  ) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizItemExposure"
  ADD CONSTRAINT "apqie_counts_check" CHECK (
    "servedCount" >= 0 AND "answeredCount" >= 0 AND "answeredCount" <= "servedCount"
  ) NOT VALID;

ALTER TABLE "PracticeQuizAdaptivePoolItem"
  ADD CONSTRAINT "pqapi_snapshot_check" CHECK (
    "elementVersion" > 0
    AND "calibrationVersion" > 0
    AND "discrimination"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "difficulty"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "guessing"::text NOT IN ('NaN', 'Infinity', '-Infinity')
    AND "discrimination" > 0
    AND "guessing" >= 0
    AND "guessing" < 1
    AND (
      ("role" = 'FIELD_TEST'::"AdaptivePoolItemRole" AND NOT "contributesToEstimate")
      OR ("role" IN ('SCORING'::"AdaptivePoolItemRole", 'ANCHOR'::"AdaptivePoolItemRole") AND "contributesToEstimate")
    )
  ) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizAttempt"
  ADD CONSTRAINT "apqa_result_check" CHECK (
    "classificationPolicyVersion" > 0
    AND "calibrationPolicyVersion" > 0
    AND ("finalBandProbability" IS NULL OR ("finalBandProbability" >= 0 AND "finalBandProbability" <= 1 AND "finalBandProbability"::text NOT IN ('NaN', 'Infinity', '-Infinity')))
    AND ("credibleLower" IS NULL OR "credibleLower"::text NOT IN ('NaN', 'Infinity', '-Infinity'))
    AND ("credibleUpper" IS NULL OR "credibleUpper"::text NOT IN ('NaN', 'Infinity', '-Infinity'))
    AND ("credibleLower" IS NULL OR "credibleUpper" IS NULL OR "credibleLower" <= "credibleUpper")
    AND ("nextAdministrationProbability" IS NULL OR ("nextAdministrationProbability" > 0 AND "nextAdministrationProbability" <= 1 AND "nextAdministrationProbability"::text NOT IN ('NaN', 'Infinity', '-Infinity')))
    AND ("nextRandomDraw" IS NULL OR ("nextRandomDraw" >= 0 AND "nextRandomDraw" <= 4294967295))
    AND (
      (
        "measurementVersion" = 'IRT_V1'::"AdaptiveMeasurementVersion"
        AND "nextAdministrationProbability" IS NULL
        AND "nextCollectionDesignVersion" IS NULL
        AND "nextRandomizationVersion" IS NULL
        AND "nextRandomDraw" IS NULL
        AND "nextCandidateSetHash" IS NULL
        AND "nextItemRole" IS NULL
      )
      OR (
        "measurementVersion" = 'IRT_V2_EAP_GRID_1'::"AdaptiveMeasurementVersion"
        AND (
          (
            "nextPoolItemId" IS NULL
            AND "nextAdministrationProbability" IS NULL
            AND "nextCollectionDesignVersion" IS NULL
            AND "nextRandomizationVersion" IS NULL
            AND "nextRandomDraw" IS NULL
            AND "nextCandidateSetHash" IS NULL
            AND "nextItemRole" IS NULL
          )
          OR (
            "nextPoolItemId" IS NOT NULL
            AND "nextAdministrationProbability" IS NOT NULL
            AND "nextRandomizationVersion" IS NOT NULL
            AND "nextRandomDraw" IS NOT NULL
            AND "nextCandidateSetHash" IS NOT NULL
            AND "nextItemRole" IS NOT NULL
          )
        )
      )
    )
  ) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizResponse"
  ADD CONSTRAINT "apqr_design_check" CHECK (
    ("administrationProbability" IS NULL OR ("administrationProbability" > 0 AND "administrationProbability" <= 1 AND "administrationProbability"::text NOT IN ('NaN', 'Infinity', '-Infinity')))
    AND ("randomDraw" IS NULL OR ("randomDraw" >= 0 AND "randomDraw" <= 4294967295))
    AND "isCalibrationAnchor" = ("itemRole" = 'ANCHOR'::"AdaptivePoolItemRole")
    AND ("overallCredibleLowerAfter" IS NULL OR "overallCredibleLowerAfter"::text NOT IN ('NaN', 'Infinity', '-Infinity'))
    AND ("overallCredibleUpperAfter" IS NULL OR "overallCredibleUpperAfter"::text NOT IN ('NaN', 'Infinity', '-Infinity'))
    AND ("overallCredibleLowerAfter" IS NULL OR "overallCredibleUpperAfter" IS NULL OR "overallCredibleLowerAfter" <= "overallCredibleUpperAfter")
  ) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizEstimate"
  DROP CONSTRAINT "apqe_runtime_values_check",
  ADD CONSTRAINT "apqe_runtime_values_check" CHECK (
    ("theta" IS NULL OR "theta" BETWEEN -10 AND 10)
    AND ("standardError" IS NULL OR "standardError" > 0)
    AND "responseCount" >= 0
    AND (
      ("theta" IS NULL AND "standardError" IS NULL)
      OR ("theta" IS NOT NULL AND "standardError" IS NOT NULL)
    )
  ) NOT VALID;

ALTER TABLE "AdaptivePracticeQuizEstimate"
  ADD CONSTRAINT "apqe_result_check" CHECK (
    ("classificationProbability" IS NULL OR ("classificationProbability" >= 0 AND "classificationProbability" <= 1 AND "classificationProbability"::text NOT IN ('NaN', 'Infinity', '-Infinity')))
    AND ("credibleLower" IS NULL OR "credibleLower"::text NOT IN ('NaN', 'Infinity', '-Infinity'))
    AND ("credibleUpper" IS NULL OR "credibleUpper"::text NOT IN ('NaN', 'Infinity', '-Infinity'))
    AND ("credibleLower" IS NULL OR "credibleUpper" IS NULL OR "credibleLower" <= "credibleUpper")
  ) NOT VALID;

ALTER TABLE "CompetenceTreeScaleVersion" VALIDATE CONSTRAINT "ctsv_numeric_check";
ALTER TABLE "CompetenceTreeScaleLevel" VALIDATE CONSTRAINT "ctsl_numeric_check";
ALTER TABLE "CompetenceTreeScaleApproval" VALIDATE CONSTRAINT "ctsa_evidence_check";
ALTER TABLE "CompetenceTreeScaleLink" VALIDATE CONSTRAINT "ctslk_versions_check";
ALTER TABLE "CompetenceTreeScaleLinkAnchor" VALIDATE CONSTRAINT "ctsla_order_check";
ALTER TABLE "AdaptiveItemCalibration" VALIDATE CONSTRAINT "aic_parameters_check";
ALTER TABLE "PracticeQuizAdaptivePublication" VALIDATE CONSTRAINT "pqap_policy_check";
ALTER TABLE "PracticeQuizAdaptivePublication" VALIDATE CONSTRAINT "pqap_lifecycle_timestamps_check";
ALTER TABLE "AdaptiveCalibrationExportRequest" VALIDATE CONSTRAINT "acer_state_check";
ALTER TABLE "AdaptivePracticeQuizEmpiricalValidation" VALIDATE CONSTRAINT "apqev_evidence_check";
ALTER TABLE "AdaptivePracticeQuizItemExposure" VALIDATE CONSTRAINT "apqie_counts_check";
ALTER TABLE "PracticeQuizAdaptivePoolItem" VALIDATE CONSTRAINT "pqapi_snapshot_check";
ALTER TABLE "AdaptivePracticeQuizAttempt" VALIDATE CONSTRAINT "apqa_result_check";
ALTER TABLE "AdaptivePracticeQuizResponse" VALIDATE CONSTRAINT "apqr_design_check";
ALTER TABLE "AdaptivePracticeQuizEstimate" VALIDATE CONSTRAINT "apqe_runtime_values_check";
ALTER TABLE "AdaptivePracticeQuizEstimate" VALIDATE CONSTRAINT "apqe_result_check";

CREATE UNIQUE INDEX "ctsv_one_active_per_tree_key"
  ON "CompetenceTreeScaleVersion"("treeId")
  WHERE "status" = 'ACTIVE'::"AdaptiveScaleVersionStatus";

CREATE UNIQUE INDEX "pqap_one_active_per_config_key"
  ON "PracticeQuizAdaptivePublication"("configId")
  WHERE "sealedAt" IS NOT NULL AND "supersededAt" IS NULL AND "unpublishedAt" IS NULL;

CREATE OR REPLACE FUNCTION adaptive_assert_scale_geometry(scale_id uuid)
RETURNS void
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

CREATE OR REPLACE FUNCTION adaptive_scale_version_guard()
RETURNS trigger
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

CREATE TRIGGER "ctsv_lifecycle_guard"
BEFORE INSERT OR UPDATE ON "CompetenceTreeScaleVersion"
FOR EACH ROW EXECUTE FUNCTION adaptive_scale_version_guard();

CREATE OR REPLACE FUNCTION adaptive_scale_level_guard()
RETURNS trigger
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

CREATE TRIGGER "ctsl_lifecycle_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "CompetenceTreeScaleLevel"
FOR EACH ROW EXECUTE FUNCTION adaptive_scale_level_guard();

CREATE OR REPLACE FUNCTION adaptive_independent_review_guard()
RETURNS trigger
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

CREATE TRIGGER "ctsa_independent_reviewer"
BEFORE INSERT OR UPDATE ON "CompetenceTreeScaleApproval"
FOR EACH ROW EXECUTE FUNCTION adaptive_independent_review_guard();
CREATE TRIGGER "ctslk_independent_reviewer"
BEFORE INSERT OR UPDATE ON "CompetenceTreeScaleLink"
FOR EACH ROW EXECUTE FUNCTION adaptive_independent_review_guard();
CREATE TRIGGER "aic_independent_reviewer"
BEFORE INSERT OR UPDATE ON "AdaptiveItemCalibration"
FOR EACH ROW EXECUTE FUNCTION adaptive_independent_review_guard();
CREATE TRIGGER "apqev_independent_reviewer"
BEFORE INSERT OR UPDATE ON "AdaptivePracticeQuizEmpiricalValidation"
FOR EACH ROW EXECUTE FUNCTION adaptive_independent_review_guard();

CREATE OR REPLACE FUNCTION adaptive_review_evidence_immutability_guard()
RETURNS trigger
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

CREATE TRIGGER "ctsa_evidence_immutability_guard"
BEFORE UPDATE OR DELETE ON "CompetenceTreeScaleApproval"
FOR EACH ROW EXECUTE FUNCTION adaptive_review_evidence_immutability_guard();
CREATE TRIGGER "apqev_evidence_immutability_guard"
BEFORE UPDATE OR DELETE ON "AdaptivePracticeQuizEmpiricalValidation"
FOR EACH ROW EXECUTE FUNCTION adaptive_review_evidence_immutability_guard();

CREATE OR REPLACE FUNCTION adaptive_scale_link_guard()
RETURNS trigger
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

CREATE TRIGGER "ctslk_lifecycle_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "CompetenceTreeScaleLink"
FOR EACH ROW EXECUTE FUNCTION adaptive_scale_link_guard();

CREATE OR REPLACE FUNCTION adaptive_scale_link_anchor_guard()
RETURNS trigger
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

CREATE TRIGGER "ctsla_identity_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "CompetenceTreeScaleLinkAnchor"
FOR EACH ROW EXECUTE FUNCTION adaptive_scale_link_anchor_guard();

CREATE OR REPLACE FUNCTION adaptive_publication_guard()
RETURNS trigger
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

CREATE TRIGGER "pqap_publication_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "PracticeQuizAdaptivePublication"
FOR EACH ROW EXECUTE FUNCTION adaptive_publication_guard();

CREATE OR REPLACE FUNCTION adaptive_pool_snapshot_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  publication_record record;
  calibration_record record;
BEGIN
  SELECT "scaleVersionId", "measurementVersion", "sealedAt", "unpublishedAt" INTO publication_record
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
       (NEW.role IN ('SCORING'::"AdaptivePoolItemRole", 'ANCHOR'::"AdaptivePoolItemRole")
        AND calibration_record.status <> 'CALIBRATED'::"AdaptiveItemCalibrationStatus")
       OR (NEW.role = 'FIELD_TEST'::"AdaptivePoolItemRole"
           AND calibration_record.status NOT IN (
             'PROVISIONAL'::"AdaptiveItemCalibrationStatus",
             'PILOT'::"AdaptiveItemCalibrationStatus"
           ))
       OR calibration_record.discrimination IS DISTINCT FROM NEW.discrimination
       OR calibration_record.difficulty IS DISTINCT FROM NEW.difficulty
       OR calibration_record.guessing IS DISTINCT FROM NEW.guessing
     ) THEN
    RAISE EXCEPTION 'IRT v2 scoring pools require exact approved calibration parameters';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER "pqapi_snapshot_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "PracticeQuizAdaptivePoolItem"
FOR EACH ROW EXECUTE FUNCTION adaptive_pool_snapshot_guard();

CREATE OR REPLACE FUNCTION adaptive_attempt_publication_guard()
RETURNS trigger
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

CREATE TRIGGER "apqa_sealed_publication_guard"
BEFORE INSERT OR UPDATE ON "AdaptivePracticeQuizAttempt"
FOR EACH ROW EXECUTE FUNCTION adaptive_attempt_publication_guard();

CREATE OR REPLACE FUNCTION adaptive_response_design_guard()
RETURNS trigger
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

CREATE TRIGGER "apqr_design_identity_guard"
BEFORE INSERT OR UPDATE ON "AdaptivePracticeQuizResponse"
FOR EACH ROW EXECUTE FUNCTION adaptive_response_design_guard();

CREATE OR REPLACE FUNCTION adaptive_calibration_immutability_guard()
RETURNS trigger
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

CREATE TRIGGER "aic_immutability_guard"
BEFORE UPDATE OR DELETE ON "AdaptiveItemCalibration"
FOR EACH ROW EXECUTE FUNCTION adaptive_calibration_immutability_guard();

COMMENT ON TABLE "CompetenceTreeScaleVersion" IS 'Versioned latent scale; activation requires independent standard-setting evidence.';
COMMENT ON TABLE "AdaptiveItemCalibration" IS 'Immutable item-parameter version for an exact tree, scale, assignment, element, and element-version identity.';
COMMENT ON TABLE "PracticeQuizAdaptivePublication" IS 'Immutable estimator, policy, scale, and cut-score snapshot for one materialized adaptive pool.';
COMMENT ON TABLE "AdaptivePracticeQuizItemExposure" IS 'Mutable aggregate exposure counters without participant identity.';
COMMENT ON COLUMN "AdaptiveCalibrationExportRequest"."artifactKey" IS 'Worker-only opaque storage key; never expose through public GraphQL.';

COMMIT;
