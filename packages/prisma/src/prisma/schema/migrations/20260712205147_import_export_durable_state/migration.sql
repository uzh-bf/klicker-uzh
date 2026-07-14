-- CreateEnum
CREATE TYPE "public"."ImportExportPackageArtifactDirection" AS ENUM ('IMPORT', 'EXPORT');

-- CreateEnum
CREATE TYPE "public"."ImportExportPackageArtifactState" AS ENUM ('PENDING', 'UPLOADING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ElementImportReceiptState" AS ENUM ('PENDING', 'COMPLETE');

-- CreateEnum
CREATE TYPE "public"."ImportMediaStagingState" AS ENUM ('RESERVED', 'COPIED', 'FINALIZED', 'CLEANUP_PENDING');

-- AlterTable
-- IF NOT EXISTS supports the documented large-table pre-step: operators may
-- add these nullable columns first, build the exact indexes concurrently, and
-- then run the immutable migration normally.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'AnswerCollection'
          AND column_name = 'importFingerprintVersion'
          AND (
              data_type <> 'integer'
              OR is_nullable <> 'YES'
              OR column_default IS NOT NULL
              OR is_identity <> 'NO'
              OR is_generated <> 'NEVER'
          )
    ) THEN
        RAISE EXCEPTION 'AnswerCollection.importFingerprintVersion exists with an incompatible definition';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'Element'
          AND column_name = 'importFingerprintVersion'
          AND (
              data_type <> 'integer'
              OR is_nullable <> 'YES'
              OR column_default IS NOT NULL
              OR is_identity <> 'NO'
              OR is_generated <> 'NEVER'
          )
    ) THEN
        RAISE EXCEPTION 'Element.importFingerprintVersion exists with an incompatible definition';
    END IF;
END $$;

ALTER TABLE "public"."AnswerCollection" ADD COLUMN IF NOT EXISTS "importFingerprintVersion" INTEGER;

-- AlterTable
ALTER TABLE "public"."Element" ADD COLUMN IF NOT EXISTS "importFingerprintVersion" INTEGER;

-- AlterTable
ALTER TABLE "public"."MediaFile" ADD COLUMN     "contentHash" TEXT;

-- CreateTable
CREATE TABLE "public"."ImportExportPackageArtifact" (
    "id" UUID NOT NULL,
    "direction" "public"."ImportExportPackageArtifactDirection" NOT NULL,
    "state" "public"."ImportExportPackageArtifactState" NOT NULL DEFAULT 'PENDING',
    "storageContainer" TEXT NOT NULL,
    "storageBlob" TEXT NOT NULL,
    "reservedBytes" INTEGER NOT NULL,
    "bytes" INTEGER,
    "sha256" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportExportPackageArtifact_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PackageArtifact_storage_target_check" CHECK (length("storageContainer") > 0 AND length("storageBlob") > 0),
    CONSTRAINT "PackageArtifact_expiry_check" CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "PackageArtifact_state_fields_check" CHECK (
        (
            "state" IN ('PENDING', 'UPLOADING')
            AND "reservedBytes" > 0
            AND "bytes" IS NULL
            AND "sha256" IS NULL
            AND "completedAt" IS NULL
        )
        OR (
            "state" = 'READY'
            AND "reservedBytes" = "bytes"
            AND "bytes" > 0
            AND "sha256" ~ '^[0-9a-f]{64}$'
            AND "completedAt" IS NOT NULL
        )
        OR (
            "state" = 'FAILED'
            AND "reservedBytes" = 0
            AND "bytes" IS NULL
            AND "sha256" IS NULL
            AND "completedAt" IS NULL
        )
    )
);

-- CreateTable
CREATE TABLE "public"."ElementImportReceipt" (
    "id" UUID NOT NULL,
    "jti" UUID NOT NULL,
    "sourceArtifactId" UUID NOT NULL,
    "artifactRecordId" UUID,
    "packageHash" TEXT NOT NULL,
    "selectionDigest" TEXT NOT NULL,
    "selectedElementRefs" JSONB NOT NULL,
    "state" "public"."ElementImportReceiptState" NOT NULL DEFAULT 'PENDING',
    "leaseId" UUID,
    "leaseExpiresAt" TIMESTAMP(3),
    "createdElementIds" JSONB NOT NULL,
    "createdAnswerCollectionIds" JSONB NOT NULL,
    "completedAt" TIMESTAMP(3),
    "retentionExpiresAt" TIMESTAMP(3),
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementImportReceipt_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ElementImportReceipt_artifact_match_check" CHECK (
        "artifactRecordId" IS NULL OR "artifactRecordId" = "sourceArtifactId"
    ),
    CONSTRAINT "ElementImportReceipt_hashes_check" CHECK (
        "packageHash" ~ '^[0-9a-f]{64}$'
        AND "selectionDigest" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "ElementImportReceipt_arrays_check" CHECK (
        jsonb_typeof("selectedElementRefs") = 'array'
        AND jsonb_array_length("selectedElementRefs") > 0
        AND jsonb_typeof("createdElementIds") = 'array'
        AND jsonb_typeof("createdAnswerCollectionIds") = 'array'
    ),
    CONSTRAINT "ElementImportReceipt_state_fields_check" CHECK (
        (
            "state" = 'PENDING'
            AND "leaseId" IS NOT NULL
            AND "leaseExpiresAt" IS NOT NULL
            AND "leaseExpiresAt" > "createdAt"
            AND "completedAt" IS NULL
            AND "retentionExpiresAt" IS NULL
            AND jsonb_array_length("createdElementIds") = 0
            AND jsonb_array_length("createdAnswerCollectionIds") = 0
        )
        OR (
            "state" = 'COMPLETE'
            AND "leaseId" IS NULL
            AND "leaseExpiresAt" IS NULL
            AND "completedAt" IS NOT NULL
            AND "retentionExpiresAt" > "completedAt"
            AND jsonb_array_length("createdElementIds") > 0
        )
    )
);

-- CreateTable
CREATE TABLE "public"."ImportMediaStaging" (
    "id" UUID NOT NULL,
    "operationId" UUID NOT NULL,
    "packageMediaRef" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "storageContainer" TEXT NOT NULL,
    "storageBlob" TEXT NOT NULL,
    "state" "public"."ImportMediaStagingState" NOT NULL DEFAULT 'RESERVED',
    "createdBlob" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "receiptId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "mediaFileId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportMediaStaging_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ImportMediaStaging_storage_target_check" CHECK (
        length("storageContainer") > 0 AND length("storageBlob") > 0
    ),
    CONSTRAINT "ImportMediaStaging_content_hash_check" CHECK (
        "contentHash" ~ '^[0-9a-f]{64}$'
    ),
    CONSTRAINT "ImportMediaStaging_expiry_check" CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "ImportMediaStaging_state_fields_check" CHECK (
        ("state" = 'RESERVED' AND NOT "createdBlob" AND "mediaFileId" IS NULL)
        OR ("state" = 'COPIED' AND "createdBlob" AND "mediaFileId" IS NULL)
        -- mediaFileId may become null later through the intentional SET NULL
        -- relation when the finalized media record is deleted.
        OR ("state" = 'FINALIZED' AND "createdBlob")
        OR ("state" = 'CLEANUP_PENDING' AND "mediaFileId" IS NULL)
    )
);

-- Enforce hash/version shape for newly written rows without scanning existing
-- potentially large tables. These constraints can be validated operationally
-- after the fingerprint backfill and production-size audit.
ALTER TABLE "public"."MediaFile"
ADD CONSTRAINT "MediaFile_contentHash_check"
CHECK ("contentHash" IS NULL OR "contentHash" ~ '^[0-9a-f]{64}$') NOT VALID;

ALTER TABLE "public"."Element"
ADD CONSTRAINT "Element_importFingerprintVersion_check"
CHECK ("importFingerprintVersion" IS NULL OR "importFingerprintVersion" > 0) NOT VALID;

ALTER TABLE "public"."AnswerCollection"
ADD CONSTRAINT "AnswerCollection_importFingerprintVersion_check"
CHECK ("importFingerprintVersion" IS NULL OR "importFingerprintVersion" > 0) NOT VALID;

-- CreateIndex
CREATE INDEX "PackageArtifact_owner_expiry_idx" ON "public"."ImportExportPackageArtifact"("ownerId", "expiresAt");

-- CreateIndex
CREATE INDEX "PackageArtifact_expiry_idx" ON "public"."ImportExportPackageArtifact"("expiresAt");

-- CreateIndex
CREATE INDEX "PackageArtifact_state_expiry_idx" ON "public"."ImportExportPackageArtifact"("state", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PackageArtifact_storage_target_key" ON "public"."ImportExportPackageArtifact"("storageContainer", "storageBlob");

-- CreateIndex
CREATE UNIQUE INDEX "ElementImportReceipt_jti_key" ON "public"."ElementImportReceipt"("jti");

-- CreateIndex
CREATE INDEX "ElementImportReceipt_artifact_record_idx" ON "public"."ElementImportReceipt"("artifactRecordId");

-- CreateIndex
CREATE INDEX "ElementImportReceipt_owner_idx" ON "public"."ElementImportReceipt"("ownerId");

-- CreateIndex
CREATE INDEX "ElementImportReceipt_state_lease_idx" ON "public"."ElementImportReceipt"("state", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "ElementImportReceipt_state_retention_idx" ON "public"."ElementImportReceipt"("state", "retentionExpiresAt");

-- CreateIndex
CREATE INDEX "ImportMediaStaging_operation_idx" ON "public"."ImportMediaStaging"("operationId");

-- CreateIndex
CREATE INDEX "ImportMediaStaging_state_expiry_idx" ON "public"."ImportMediaStaging"("state", "expiresAt");

-- CreateIndex
CREATE INDEX "ImportMediaStaging_owner_expiry_idx" ON "public"."ImportMediaStaging"("ownerId", "expiresAt");

-- CreateIndex
CREATE INDEX "ImportMediaStaging_media_file_idx" ON "public"."ImportMediaStaging"("mediaFileId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportMediaStaging_receipt_ref_key" ON "public"."ImportMediaStaging"("receiptId", "packageMediaRef");

-- CreateIndex
CREATE UNIQUE INDEX "ImportMediaStaging_storage_target_key" ON "public"."ImportMediaStaging"("storageContainer", "storageBlob");

-- CreateIndex
-- Large environments pre-create this exact index with CREATE INDEX
-- CONCURRENTLY before migrate deploy. IF NOT EXISTS then makes this step a
-- no-op; small/fresh environments can create it inline.
CREATE INDEX IF NOT EXISTS "AnswerCollection_owner_fpv_fp_idx" ON "public"."AnswerCollection"("ownerId", "importFingerprintVersion", "importFingerprint");

DO $$
DECLARE
    actual_definition TEXT;
    index_is_ready BOOLEAN;
    index_is_valid BOOLEAN;
BEGIN
    SELECT pg_get_indexdef(indexrelid), indisready, indisvalid
    INTO actual_definition, index_is_ready, index_is_valid
    FROM pg_index
    WHERE indexrelid = 'public."AnswerCollection_owner_fpv_fp_idx"'::regclass;

    IF actual_definition <> 'CREATE INDEX "AnswerCollection_owner_fpv_fp_idx" ON public."AnswerCollection" USING btree ("ownerId", "importFingerprintVersion", "importFingerprint")'
       OR NOT index_is_ready
       OR NOT index_is_valid THEN
        RAISE EXCEPTION 'AnswerCollection_owner_fpv_fp_idx exists with an incompatible or invalid definition';
    END IF;
END $$;

-- CreateIndex
-- See the non-blocking pre-create note above.
CREATE INDEX IF NOT EXISTS "Element_owner_fpv_fp_idx" ON "public"."Element"("ownerId", "importFingerprintVersion", "importFingerprint");

DO $$
DECLARE
    actual_definition TEXT;
    index_is_ready BOOLEAN;
    index_is_valid BOOLEAN;
BEGIN
    SELECT pg_get_indexdef(indexrelid), indisready, indisvalid
    INTO actual_definition, index_is_ready, index_is_valid
    FROM pg_index
    WHERE indexrelid = 'public."Element_owner_fpv_fp_idx"'::regclass;

    IF actual_definition <> 'CREATE INDEX "Element_owner_fpv_fp_idx" ON public."Element" USING btree ("ownerId", "importFingerprintVersion", "importFingerprint")'
       OR NOT index_is_ready
       OR NOT index_is_valid THEN
        RAISE EXCEPTION 'Element_owner_fpv_fp_idx exists with an incompatible or invalid definition';
    END IF;
END $$;

-- AddForeignKey
ALTER TABLE "public"."ImportExportPackageArtifact" ADD CONSTRAINT "ImportExportPackageArtifact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ElementImportReceipt" ADD CONSTRAINT "ElementImportReceipt_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ElementImportReceipt" ADD CONSTRAINT "ElementImportReceipt_artifactRecordId_fkey" FOREIGN KEY ("artifactRecordId") REFERENCES "public"."ImportExportPackageArtifact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportMediaStaging" ADD CONSTRAINT "ImportMediaStaging_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."ElementImportReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportMediaStaging" ADD CONSTRAINT "ImportMediaStaging_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ImportMediaStaging" ADD CONSTRAINT "ImportMediaStaging_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "public"."MediaFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Durable ownership invariants. Single-column foreign keys establish row
-- existence; these triggers additionally prevent cross-owner links while still
-- allowing the nullable artifact/media relations to be cleared on expiry or
-- deletion.
CREATE FUNCTION "public"."enforce_element_import_receipt_artifact_owner"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."artifactRecordId" IS NOT NULL
       AND NOT EXISTS (
           SELECT 1
           FROM "public"."ImportExportPackageArtifact" artifact
           WHERE artifact."id" = NEW."artifactRecordId"
             AND artifact."ownerId" = NEW."ownerId"
       ) THEN
        RAISE EXCEPTION 'Import receipt artifact owner mismatch'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'ElementImportReceipt_artifact_owner_check';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "ElementImportReceipt_artifact_owner_trigger"
BEFORE INSERT OR UPDATE ON "public"."ElementImportReceipt"
FOR EACH ROW
EXECUTE FUNCTION "public"."enforce_element_import_receipt_artifact_owner"();

CREATE FUNCTION "public"."enforce_import_media_staging_owners"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    media_owner_id UUID;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM "public"."ElementImportReceipt" receipt
        WHERE receipt."id" = NEW."receiptId"
          AND receipt."ownerId" = NEW."ownerId"
    ) THEN
        RAISE EXCEPTION 'Import media staging receipt owner mismatch'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'ImportMediaStaging_receipt_owner_check';
    END IF;

    IF NEW."mediaFileId" IS NOT NULL THEN
        -- Serialize against MediaFile owner transfers. If staging wins the
        -- lock, the later transfer trigger detaches this row. If transfer wins,
        -- this query observes the new owner and rejects the link.
        SELECT media."ownerId"
        INTO media_owner_id
        FROM "public"."MediaFile" media
        WHERE media."id" = NEW."mediaFileId"
        FOR NO KEY UPDATE;

        IF NOT FOUND OR media_owner_id IS DISTINCT FROM NEW."ownerId" THEN
            RAISE EXCEPTION 'Import media staging file owner mismatch'
                USING ERRCODE = '23514',
                      CONSTRAINT = 'ImportMediaStaging_media_owner_check';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "ImportMediaStaging_owner_trigger"
BEFORE INSERT OR UPDATE ON "public"."ImportMediaStaging"
FOR EACH ROW
EXECUTE FUNCTION "public"."enforce_import_media_staging_owners"();

CREATE FUNCTION "public"."prevent_import_export_owner_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."ownerId" IS DISTINCT FROM OLD."ownerId" THEN
        RAISE EXCEPTION 'Import/export durable-state ownership is immutable'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'ImportExport_owner_immutable_check';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "PackageArtifact_owner_immutable_trigger"
BEFORE UPDATE OF "ownerId" ON "public"."ImportExportPackageArtifact"
FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_import_export_owner_change"();

CREATE TRIGGER "ElementImportReceipt_owner_immutable_trigger"
BEFORE UPDATE OF "ownerId" ON "public"."ElementImportReceipt"
FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_import_export_owner_change"();

CREATE TRIGGER "ImportMediaStaging_owner_immutable_trigger"
BEFORE UPDATE OF "ownerId" ON "public"."ImportMediaStaging"
FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_import_export_owner_change"();

-- Media ownership can legitimately change through transferUserContent. Detach
-- finalized staging history from the transferred media row, matching the
-- existing ON DELETE SET NULL lifecycle without rewriting receipt ownership.
CREATE FUNCTION "public"."detach_import_staging_on_media_owner_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."ownerId" IS DISTINCT FROM OLD."ownerId" THEN
        UPDATE "public"."ImportMediaStaging"
        SET "mediaFileId" = NULL,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE "mediaFileId" = OLD."id";
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "MediaFile_detach_import_staging_owner_change_trigger"
BEFORE UPDATE OF "ownerId" ON "public"."MediaFile"
FOR EACH ROW
EXECUTE FUNCTION "public"."detach_import_staging_on_media_owner_change"();
