BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE "Element"
  ADD COLUMN "creationRequestId" UUID,
  ADD COLUMN "creationRequestFingerprint" VARCHAR(64);

CREATE UNIQUE INDEX "element_creation_request_key"
  ON "Element"("creationRequestId");

ALTER TABLE "Element"
  ADD CONSTRAINT "element_creation_request_identity_check" CHECK (
    ("creationRequestId" IS NULL AND "creationRequestFingerprint" IS NULL)
    OR (
      "creationRequestId" IS NOT NULL
      AND "creationRequestFingerprint" IS NOT NULL
      AND "creationRequestFingerprint" ~ '^[0-9a-f]{64}$'
    )
  ) NOT VALID;

ALTER TABLE "Element"
  VALIDATE CONSTRAINT "element_creation_request_identity_check";

ALTER TABLE "AdaptiveCalibrationExportRequest"
  ADD COLUMN "runToken" UUID;

UPDATE "AdaptiveCalibrationExportRequest"
SET "runToken" = gen_random_uuid()
WHERE "status" = 'RUNNING'::"AdaptiveCalibrationExportStatus";

ALTER TABLE "AdaptiveCalibrationExportRequest"
  ADD CONSTRAINT "acer_running_lease_check" CHECK (
    ("status" = 'RUNNING'::"AdaptiveCalibrationExportStatus")
    = ("runToken" IS NOT NULL)
  ) NOT VALID;

ALTER TABLE "AdaptiveCalibrationExportRequest"
  VALIDATE CONSTRAINT "acer_running_lease_check";

COMMENT ON COLUMN "Element"."creationRequestId" IS
  'Durable idempotency token for atomic first-save element creation and assignment.';
COMMENT ON COLUMN "Element"."creationRequestFingerprint" IS
  'SHA-256 fingerprint of the immutable first-save element and assignment request.';
COMMENT ON COLUMN "AdaptiveCalibrationExportRequest"."runToken" IS
  'Lease token fencing terminal updates and artifacts to one export worker run.';

COMMIT;
