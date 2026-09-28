BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP INDEX "ctsla_link_pair_key";

CREATE UNIQUE INDEX "ctsla_link_from_key"
  ON "CompetenceTreeScaleLinkAnchor"("scaleLinkId", "fromCalibrationId");

CREATE UNIQUE INDEX "ctsla_link_to_key"
  ON "CompetenceTreeScaleLinkAnchor"("scaleLinkId", "toCalibrationId");

COMMIT;
