BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE "AdaptiveCalibrationExportRequest"
  ADD COLUMN "datasetVersion" TEXT NOT NULL DEFAULT 'legacy-v1',
  ADD COLUMN "splitPolicyVersion" TEXT NOT NULL DEFAULT 'HMAC_80_20_V1',
  ADD COLUMN "manifestArtifactKey" TEXT,
  ADD COLUMN "manifestChecksum" TEXT,
  ADD COLUMN "holdoutArtifactKey" TEXT,
  ADD COLUMN "holdoutArtifactChecksum" TEXT,
  ADD COLUMN "holdoutRowCount" INTEGER,
  ADD COLUMN "criterionArtifactKey" TEXT,
  ADD COLUMN "criterionArtifactChecksum" TEXT;

ALTER TABLE "AdaptiveCalibrationExportRequest"
  ALTER COLUMN "datasetVersion" DROP DEFAULT,
  DROP CONSTRAINT "acer_state_check",
  ADD CONSTRAINT "acer_state_check" CHECK (
    length("datasetVersion") BETWEEN 1 AND 160
    AND length("splitPolicyVersion") BETWEEN 1 AND 160
    AND ("rowCount" IS NULL OR "rowCount" >= 0)
    AND ("holdoutRowCount" IS NULL OR "holdoutRowCount" >= 0)
    AND (("criterionArtifactKey" IS NULL) = ("criterionArtifactChecksum" IS NULL))
    AND ("criterionArtifactChecksum" IS NULL OR "criterionArtifactChecksum" ~ '^[a-f0-9]{64}$')
    AND "expiresAt" > "createdAt"
    AND (
      "status" <> 'READY'::"AdaptiveCalibrationExportStatus"
      OR (
        "artifactKey" IS NOT NULL
        AND "artifactChecksum" ~ '^[a-f0-9]{64}$'
        AND "rowCount" IS NOT NULL
        AND "manifestArtifactKey" IS NOT NULL
        AND "manifestChecksum" ~ '^[a-f0-9]{64}$'
        AND "holdoutArtifactKey" IS NOT NULL
        AND "holdoutArtifactChecksum" ~ '^[a-f0-9]{64}$'
        AND "holdoutRowCount" IS NOT NULL
        AND "completedAt" IS NOT NULL
      )
    )
    AND (
      "status" <> 'FAILED'::"AdaptiveCalibrationExportStatus"
      OR ("failureCode" IS NOT NULL AND "completedAt" IS NOT NULL)
    )
  ) NOT VALID;

ALTER TABLE "AdaptiveCalibrationExportRequest"
  VALIDATE CONSTRAINT "acer_state_check";

COMMENT ON COLUMN "AdaptiveCalibrationExportRequest"."manifestArtifactKey" IS
  'Worker-only opaque storage key; never expose through public GraphQL.';
COMMENT ON COLUMN "AdaptiveCalibrationExportRequest"."holdoutArtifactKey" IS
  'Sealed worker/reviewer-only storage key; never expose to the tree owner.';
COMMENT ON COLUMN "AdaptiveCalibrationExportRequest"."criterionArtifactKey" IS
  'Sealed reviewer-provided criterion key; retained only until validation succeeds or the export expires.';

COMMIT;
