-- Version the media-side fingerprint decision independently from the content
-- hash. For version 1, a row with a hash is package-portable; a row without a
-- hash is a known omission. NULL means the decision still needs backfilling.
ALTER TABLE "public"."MediaFile"
ADD COLUMN "importFingerprintVersion" INTEGER;

ALTER TABLE "public"."MediaFile"
ADD CONSTRAINT "MediaFile_importFingerprintVersion_check"
CHECK ("importFingerprintVersion" IS NULL OR "importFingerprintVersion" > 0) NOT VALID;

CREATE INDEX "MediaFile_import_fpv_id_idx"
ON "public"."MediaFile"("importFingerprintVersion", "id");
