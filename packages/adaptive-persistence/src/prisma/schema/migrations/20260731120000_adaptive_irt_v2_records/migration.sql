-- Expand the adaptive-learning persistence model without rewriting legacy rows.
-- References that depend on backfilled identities are added in the contract migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

CREATE TYPE "AdaptiveMeasurementVersion" AS ENUM ('IRT_V1', 'IRT_V2_EAP_GRID_1');
CREATE TYPE "AdaptiveScaleVersionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'ACTIVE', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "AdaptiveScaleLinkStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "AdaptiveItemCalibrationStatus" AS ENUM ('PROVISIONAL', 'PILOT', 'CALIBRATED', 'FLAGGED', 'RETIRED');
CREATE TYPE "AdaptiveItemModel" AS ENUM ('TWO_PL', 'THREE_PL_FIXED_C');
CREATE TYPE "AdaptiveCalibrationExportStatus" AS ENUM ('REQUESTED', 'RUNNING', 'READY', 'FAILED', 'EXPIRED');
CREATE TYPE "AdaptiveEmpiricalValidationStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "AdaptiveResultStatus" AS ENUM ('CLASSIFIED', 'BETWEEN_LEVELS', 'INSUFFICIENT_EVIDENCE', 'POOL_LIMITED', 'RESEARCH_ONLY');
CREATE TYPE "AdaptivePoolItemRole" AS ENUM ('SCORING', 'ANCHOR', 'FIELD_TEST');

ALTER TABLE "Course"
  ADD COLUMN "isAdaptiveLearningCalibrationEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "PracticeQuizAdaptiveConfig"
  ADD COLUMN "measurementVersion" "AdaptiveMeasurementVersion" NOT NULL DEFAULT 'IRT_V1',
  ADD COLUMN "calibrationPolicyVersion" INTEGER,
  ADD COLUMN "scaleVersionId" UUID;

ALTER TABLE "PracticeQuizAdaptivePoolItem"
  ADD COLUMN "publicationId" UUID,
  ADD COLUMN "scaleVersionId" UUID,
  ADD COLUMN "calibrationId" UUID,
  ADD COLUMN "measurementVersion" "AdaptiveMeasurementVersion",
  ADD COLUMN "calibrationVersion" INTEGER,
  ADD COLUMN "calibrationStatus" "AdaptiveItemCalibrationStatus",
  ADD COLUMN "itemModel" "AdaptiveItemModel",
  ADD COLUMN "modelImplementationVersion" TEXT,
  ADD COLUMN "role" "AdaptivePoolItemRole" NOT NULL DEFAULT 'SCORING',
  ADD COLUMN "contributesToEstimate" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "AdaptivePracticeQuizAttempt"
  ADD COLUMN "publicationId" UUID,
  ADD COLUMN "scaleVersionId" UUID,
  ADD COLUMN "measurementVersion" "AdaptiveMeasurementVersion",
  ADD COLUMN "estimatorImplementationVersion" TEXT,
  ADD COLUMN "classificationPolicyVersion" INTEGER,
  ADD COLUMN "calibrationPolicyVersion" INTEGER,
  ADD COLUMN "finalScaleLevelId" INTEGER,
  ADD COLUMN "nextAdministrationProbability" DOUBLE PRECISION,
  ADD COLUMN "nextCollectionDesignVersion" TEXT,
  ADD COLUMN "nextRandomizationVersion" TEXT,
  ADD COLUMN "nextRandomDraw" BIGINT,
  ADD COLUMN "nextCandidateSetHash" TEXT,
  ADD COLUMN "nextItemRole" "AdaptivePoolItemRole",
  ADD COLUMN "resultStatus" "AdaptiveResultStatus",
  ADD COLUMN "finalBandProbability" DOUBLE PRECISION,
  ADD COLUMN "credibleLower" DOUBLE PRECISION,
  ADD COLUMN "credibleUpper" DOUBLE PRECISION,
  ADD COLUMN "bandProbabilities" JSONB;

ALTER TABLE "AdaptivePracticeQuizResponse"
  ADD COLUMN "publicationId" UUID,
  ADD COLUMN "overallCredibleLowerAfter" DOUBLE PRECISION,
  ADD COLUMN "overallCredibleUpperAfter" DOUBLE PRECISION,
  ADD COLUMN "overallBandProbabilitiesAfter" JSONB,
  ADD COLUMN "administrationProbability" DOUBLE PRECISION,
  ADD COLUMN "collectionDesignVersion" TEXT,
  ADD COLUMN "randomizationVersion" TEXT,
  ADD COLUMN "randomDraw" BIGINT,
  ADD COLUMN "candidateSetHash" TEXT,
  ADD COLUMN "itemRole" "AdaptivePoolItemRole" NOT NULL DEFAULT 'SCORING',
  ADD COLUMN "isCalibrationAnchor" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AdaptivePracticeQuizEstimate"
  ADD COLUMN "resultStatus" "AdaptiveResultStatus",
  ADD COLUMN "classificationProbability" DOUBLE PRECISION,
  ADD COLUMN "credibleLower" DOUBLE PRECISION,
  ADD COLUMN "credibleUpper" DOUBLE PRECISION,
  ADD COLUMN "bandProbabilities" JSONB;

CREATE TABLE "CompetenceTreeScaleVersion" (
  "id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "AdaptiveScaleVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "priorMean" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "priorStandardDeviation" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "gridMin" DOUBLE PRECISION NOT NULL DEFAULT -6,
  "gridMax" DOUBLE PRECISION NOT NULL DEFAULT 6,
  "gridStep" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
  "classificationPolicyVersion" INTEGER NOT NULL DEFAULT 1,
  "treeId" UUID NOT NULL,
  "supersedesVersionId" UUID,
  "createdById" UUID,
  "submittedForReviewAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetenceTreeScaleVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompetenceTreeScaleLevel" (
  "id" SERIAL NOT NULL,
  "order" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "lowerBound" DOUBLE PRECISION,
  "itemDifficultyPrior" DOUBLE PRECISION NOT NULL,
  "treeId" UUID NOT NULL,
  "scaleVersionId" UUID NOT NULL,
  "sourceLevelId" INTEGER,
  CONSTRAINT "CompetenceTreeScaleLevel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompetenceTreeScaleApproval" (
  "id" UUID NOT NULL,
  "treeId" UUID NOT NULL,
  "scaleVersionId" UUID NOT NULL,
  "method" TEXT NOT NULL,
  "methodVersion" TEXT NOT NULL,
  "panelSize" INTEGER NOT NULL,
  "standardSettingDate" TIMESTAMP(3) NOT NULL,
  "cutRationale" JSONB NOT NULL,
  "artifactChecksum" TEXT NOT NULL,
  "artifactKey" TEXT NOT NULL,
  "decision" "AdaptiveScaleVersionStatus",
  "submittedById" UUID,
  "reviewerId" UUID,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetenceTreeScaleApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompetenceTreeScaleLink" (
  "id" UUID NOT NULL,
  "status" "AdaptiveScaleLinkStatus" NOT NULL DEFAULT 'DRAFT',
  "treeId" UUID NOT NULL,
  "fromScaleVersionId" UUID NOT NULL,
  "toScaleVersionId" UUID NOT NULL,
  "method" TEXT NOT NULL,
  "implementationVersion" TEXT NOT NULL,
  "fitMetrics" JSONB NOT NULL,
  "uncertaintyMetrics" JSONB NOT NULL,
  "artifactChecksum" TEXT NOT NULL,
  "artifactKey" TEXT NOT NULL,
  "createdById" UUID,
  "reviewedById" UUID,
  "submittedForReviewAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompetenceTreeScaleLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompetenceTreeScaleLinkAnchor" (
  "id" SERIAL NOT NULL,
  "scaleLinkId" UUID NOT NULL,
  "fromCalibrationId" UUID NOT NULL,
  "toCalibrationId" UUID NOT NULL,
  "order" INTEGER NOT NULL,
  CONSTRAINT "CompetenceTreeScaleLinkAnchor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdaptiveItemCalibration" (
  "id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "model" "AdaptiveItemModel" NOT NULL,
  "status" "AdaptiveItemCalibrationStatus" NOT NULL DEFAULT 'PROVISIONAL',
  "discrimination" DOUBLE PRECISION NOT NULL,
  "difficulty" DOUBLE PRECISION NOT NULL,
  "guessing" DOUBLE PRECISION NOT NULL,
  "parameterUncertainty" JSONB NOT NULL,
  "responseCount" INTEGER NOT NULL DEFAULT 0,
  "participantCount" INTEGER NOT NULL DEFAULT 0,
  "diagnostics" JSONB NOT NULL,
  "datasetVersion" TEXT NOT NULL,
  "datasetChecksum" TEXT NOT NULL,
  "calibrationJobId" TEXT,
  "modelImplementationVersion" TEXT NOT NULL,
  "elementContentChecksum" TEXT NOT NULL,
  "treeId" UUID NOT NULL,
  "scaleVersionId" UUID NOT NULL,
  "assignmentId" INTEGER NOT NULL,
  "elementId" INTEGER NOT NULL,
  "elementVersion" INTEGER NOT NULL,
  "createdById" UUID,
  "approvedById" UUID,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdaptiveItemCalibration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PracticeQuizAdaptivePublication" (
  "id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "configId" UUID NOT NULL,
  "competenceTreeId" UUID NOT NULL,
  "scaleVersionId" UUID NOT NULL,
  "measurementVersion" "AdaptiveMeasurementVersion" NOT NULL,
  "preset" "AdaptivePracticeQuizPreset" NOT NULL,
  "estimatorImplementationVersion" TEXT NOT NULL,
  "classificationPolicyVersion" INTEGER NOT NULL,
  "calibrationPolicyVersion" INTEGER NOT NULL,
  "cutScoreSnapshot" JSONB NOT NULL,
  "priorMean" DOUBLE PRECISION NOT NULL,
  "priorStandardDeviation" DOUBLE PRECISION NOT NULL,
  "gridMin" DOUBLE PRECISION NOT NULL,
  "gridMax" DOUBLE PRECISION NOT NULL,
  "gridStep" DOUBLE PRECISION NOT NULL,
  "classificationProbabilityThreshold" DOUBLE PRECISION,
  "hierarchicalWeightSnapshot" JSONB NOT NULL,
  "evidenceMinimumSnapshot" JSONB NOT NULL,
  "totalQuestionCap" INTEGER NOT NULL,
  "showTimer" BOOLEAN NOT NULL,
  "questionCapSnapshot" JSONB NOT NULL,
  "candidateSetPolicyVersion" TEXT NOT NULL,
  "randomizationPolicyVersion" TEXT NOT NULL,
  "exposureCeiling" DOUBLE PRECISION NOT NULL,
  "overlapPolicyVersion" TEXT NOT NULL,
  "retakePolicy" "AdaptiveAttemptSelectionPolicy" NOT NULL,
  "retakeCooldownDays" INTEGER NOT NULL,
  "researchAllocationPolicy" JSONB,
  "stoppingPolicyVersion" TEXT NOT NULL,
  "rolloutPolicyVersion" INTEGER NOT NULL,
  "empiricalValidationId" UUID,
  "publishedById" UUID,
  "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sealedAt" TIMESTAMP(3),
  "supersededAt" TIMESTAMP(3),
  "unpublishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PracticeQuizAdaptivePublication_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AdaptivePracticeQuizCohortSnapshot"
  ADD COLUMN "publicationId" UUID,
  ADD COLUMN "scaleVersionId" UUID,
  ADD COLUMN "measurementVersion" "AdaptiveMeasurementVersion";

CREATE TABLE "AdaptiveCalibrationExportRequest" (
  "id" UUID NOT NULL,
  "status" "AdaptiveCalibrationExportStatus" NOT NULL DEFAULT 'REQUESTED',
  "treeId" UUID NOT NULL,
  "scaleVersionId" UUID NOT NULL,
  "requestedById" UUID,
  "artifactKey" TEXT,
  "artifactChecksum" TEXT,
  "rowCount" INTEGER,
  "failureCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdaptiveCalibrationExportRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdaptivePracticeQuizEmpiricalValidation" (
  "id" UUID NOT NULL,
  "status" "AdaptiveEmpiricalValidationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "configId" UUID NOT NULL,
  "competenceTreeId" UUID NOT NULL,
  "scaleVersionId" UUID NOT NULL,
  "exportRequestId" UUID NOT NULL,
  "bankFingerprint" TEXT NOT NULL,
  "configFingerprint" TEXT NOT NULL,
  "measurementVersion" "AdaptiveMeasurementVersion" NOT NULL,
  "estimatorImplementationVersion" TEXT NOT NULL,
  "classificationPolicyVersion" INTEGER NOT NULL,
  "calibrationPolicyVersion" INTEGER NOT NULL,
  "validationProtocolVersion" TEXT NOT NULL,
  "approvedProbabilityThreshold" DOUBLE PRECISION NOT NULL,
  "calibrationDatasetVersion" TEXT NOT NULL,
  "calibrationDatasetChecksum" TEXT NOT NULL,
  "holdoutDatasetVersion" TEXT NOT NULL,
  "holdoutDatasetChecksum" TEXT NOT NULL,
  "disjointSplitProofChecksum" TEXT NOT NULL,
  "criterionArtifactChecksum" TEXT NOT NULL,
  "aggregateMetrics" JSONB NOT NULL,
  "stratumMetrics" JSONB NOT NULL,
  "artifactChecksum" TEXT NOT NULL,
  "artifactKey" TEXT NOT NULL,
  "submittedById" UUID,
  "approvedById" UUID,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdaptivePracticeQuizEmpiricalValidation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdaptivePracticeQuizItemExposure" (
  "id" SERIAL NOT NULL,
  "publicationId" UUID NOT NULL,
  "poolItemId" INTEGER NOT NULL,
  "servedCount" BIGINT NOT NULL DEFAULT 0,
  "answeredCount" BIGINT NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdaptivePracticeQuizItemExposure_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ctsv_tree_status_idx" ON "CompetenceTreeScaleVersion"("treeId", "status");
CREATE INDEX "ctsv_created_by_idx" ON "CompetenceTreeScaleVersion"("createdById");
CREATE UNIQUE INDEX "ctsv_tree_version_key" ON "CompetenceTreeScaleVersion"("treeId", "version");
CREATE UNIQUE INDEX "ctsv_tree_id_key" ON "CompetenceTreeScaleVersion"("treeId", "id");
CREATE INDEX "ctsl_tree_source_level_idx" ON "CompetenceTreeScaleLevel"("treeId", "sourceLevelId");
CREATE UNIQUE INDEX "ctsl_scale_order_key" ON "CompetenceTreeScaleLevel"("scaleVersionId", "order");
CREATE UNIQUE INDEX "ctsl_scale_id_key" ON "CompetenceTreeScaleLevel"("scaleVersionId", "id");
CREATE UNIQUE INDEX "ctsl_tree_scale_id_key" ON "CompetenceTreeScaleLevel"("treeId", "scaleVersionId", "id");
CREATE INDEX "ctsa_tree_scale_idx" ON "CompetenceTreeScaleApproval"("treeId", "scaleVersionId");
CREATE INDEX "ctsa_submitted_by_idx" ON "CompetenceTreeScaleApproval"("submittedById");
CREATE INDEX "ctsa_reviewer_idx" ON "CompetenceTreeScaleApproval"("reviewerId");
CREATE INDEX "ctslk_created_by_idx" ON "CompetenceTreeScaleLink"("createdById");
CREATE INDEX "ctslk_reviewed_by_idx" ON "CompetenceTreeScaleLink"("reviewedById");
CREATE UNIQUE INDEX "ctslk_tree_versions_key" ON "CompetenceTreeScaleLink"("treeId", "fromScaleVersionId", "toScaleVersionId");
CREATE INDEX "ctsla_from_calibration_idx" ON "CompetenceTreeScaleLinkAnchor"("fromCalibrationId");
CREATE INDEX "ctsla_to_calibration_idx" ON "CompetenceTreeScaleLinkAnchor"("toCalibrationId");
CREATE UNIQUE INDEX "ctsla_link_order_key" ON "CompetenceTreeScaleLinkAnchor"("scaleLinkId", "order");
CREATE UNIQUE INDEX "ctsla_link_pair_key" ON "CompetenceTreeScaleLinkAnchor"("scaleLinkId", "fromCalibrationId", "toCalibrationId");
CREATE INDEX "aic_assignment_element_version_idx" ON "AdaptiveItemCalibration"("assignmentId", "elementId", "elementVersion");
CREATE INDEX "aic_scale_status_idx" ON "AdaptiveItemCalibration"("scaleVersionId", "status");
CREATE INDEX "aic_approved_by_idx" ON "AdaptiveItemCalibration"("approvedById");
CREATE UNIQUE INDEX "aic_measurement_version_key" ON "AdaptiveItemCalibration"("treeId", "scaleVersionId", "assignmentId", "elementId", "elementVersion", "version");
CREATE UNIQUE INDEX "aic_tree_scale_id_key" ON "AdaptiveItemCalibration"("treeId", "scaleVersionId", "id");
CREATE UNIQUE INDEX "aic_pool_identity_key" ON "AdaptiveItemCalibration"("treeId", "scaleVersionId", "id", "assignmentId", "elementId", "elementVersion");
CREATE INDEX "pqap_scale_idx" ON "PracticeQuizAdaptivePublication"("scaleVersionId");
CREATE INDEX "pqap_validation_idx" ON "PracticeQuizAdaptivePublication"("empiricalValidationId");
CREATE INDEX "pqap_published_by_idx" ON "PracticeQuizAdaptivePublication"("publishedById");
CREATE UNIQUE INDEX "pqap_config_version_key" ON "PracticeQuizAdaptivePublication"("configId", "version");
CREATE UNIQUE INDEX "pqap_config_id_key" ON "PracticeQuizAdaptivePublication"("configId", "id");
CREATE UNIQUE INDEX "pqap_tree_id_key" ON "PracticeQuizAdaptivePublication"("competenceTreeId", "id");
CREATE UNIQUE INDEX "pqap_id_scale_measurement_key" ON "PracticeQuizAdaptivePublication"("id", "scaleVersionId", "measurementVersion");
CREATE UNIQUE INDEX "pqap_id_config_tree_key" ON "PracticeQuizAdaptivePublication"("id", "configId", "competenceTreeId");
CREATE UNIQUE INDEX "pqap_dispatch_identity_key" ON "PracticeQuizAdaptivePublication"("id", "configId", "competenceTreeId", "scaleVersionId", "measurementVersion", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion");

DROP INDEX "apqcs_release_policy_key";
CREATE UNIQUE INDEX "apqcs_publication_release_policy_key"
  ON "AdaptivePracticeQuizCohortSnapshot"("publicationId", "releaseSize", "policyVersion", "attemptSelectionPolicy");
CREATE INDEX "acer_tree_scale_status_idx" ON "AdaptiveCalibrationExportRequest"("treeId", "scaleVersionId", "status");
CREATE INDEX "acer_requester_created_idx" ON "AdaptiveCalibrationExportRequest"("requestedById", "createdAt");
CREATE INDEX "acer_status_expiry_idx" ON "AdaptiveCalibrationExportRequest"("status", "expiresAt");
CREATE INDEX "apqev_config_status_idx" ON "AdaptivePracticeQuizEmpiricalValidation"("configId", "status");
CREATE INDEX "apqev_scale_idx" ON "AdaptivePracticeQuizEmpiricalValidation"("scaleVersionId");
CREATE INDEX "apqev_export_request_idx" ON "AdaptivePracticeQuizEmpiricalValidation"("exportRequestId");
CREATE INDEX "apqev_submitted_by_idx" ON "AdaptivePracticeQuizEmpiricalValidation"("submittedById");
CREATE INDEX "apqev_approved_by_idx" ON "AdaptivePracticeQuizEmpiricalValidation"("approvedById");
CREATE UNIQUE INDEX "apqev_publication_identity_key" ON "AdaptivePracticeQuizEmpiricalValidation"("id", "configId", "competenceTreeId", "scaleVersionId", "measurementVersion", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion");
CREATE UNIQUE INDEX "apqev_evidence_identity_key" ON "AdaptivePracticeQuizEmpiricalValidation"("configId", "bankFingerprint", "configFingerprint", "scaleVersionId", "estimatorImplementationVersion", "classificationPolicyVersion", "calibrationPolicyVersion", "validationProtocolVersion", "approvedProbabilityThreshold", "exportRequestId", "criterionArtifactChecksum");
CREATE INDEX "apqie_publication_served_idx" ON "AdaptivePracticeQuizItemExposure"("publicationId", "servedCount");
CREATE UNIQUE INDEX "apqie_publication_pool_key" ON "AdaptivePracticeQuizItemExposure"("publicationId", "poolItemId");

CREATE INDEX "apqa_publication_next_pool_idx" ON "AdaptivePracticeQuizAttempt"("publicationId", "nextPoolItemId");
CREATE INDEX "apqa_scale_version_idx" ON "AdaptivePracticeQuizAttempt"("scaleVersionId");
CREATE UNIQUE INDEX "apqa_id_config_publication_key" ON "AdaptivePracticeQuizAttempt"("id", "configId", "publicationId");
CREATE INDEX "apqr_publication_pool_attempt_idx" ON "AdaptivePracticeQuizResponse"("publicationId", "poolItemId", "attemptId");
CREATE INDEX "pqapi_publication_leaf_level_idx" ON "PracticeQuizAdaptivePoolItem"("publicationId", "leafNodeId", "levelId");
CREATE INDEX "pqapi_calibration_idx" ON "PracticeQuizAdaptivePoolItem"("calibrationId");
CREATE UNIQUE INDEX "pqapi_publication_assignment_key" ON "PracticeQuizAdaptivePoolItem"("publicationId", "sourceAssignmentId");
CREATE UNIQUE INDEX "pqapi_publication_id_key" ON "PracticeQuizAdaptivePoolItem"("publicationId", "id");
CREATE UNIQUE INDEX "pqapi_publication_response_key" ON "PracticeQuizAdaptivePoolItem"("publicationId", "id", "sourceAssignmentId", "elementId");
CREATE UNIQUE INDEX "ctea_tree_id_element_key" ON "CompetenceTreeElementAssignment"("treeId", "id", "elementId");

COMMIT;
