BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE "CompetenceTreeElementAssignment"
  ADD COLUMN "creationRequestId" UUID;

CREATE UNIQUE INDEX "ctea_creation_request_key"
  ON "CompetenceTreeElementAssignment"("creationRequestId");

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

COMMENT ON COLUMN "CompetenceTreeElementAssignment"."creationRequestId" IS
  'Idempotency token for atomic first-save element creation and assignment.';
COMMENT ON COLUMN "AdaptiveCalibrationExportRequest"."runToken" IS
  'Lease token fencing terminal updates and artifacts to one export worker run.';

COMMIT;
