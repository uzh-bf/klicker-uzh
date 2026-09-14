-- CreateIndex
-- Large environments may pre-create these exact indexes concurrently before
-- migrate deploy. The index validation block rejects incompatible or
-- incomplete same-name relations after an IF NOT EXISTS no-op and revalidates
-- the four earlier concurrently pre-creatable indexes.
CREATE INDEX IF NOT EXISTS "AnswerCollection_repair_fpv_deleted_id_idx"
ON "public"."AnswerCollection"("importFingerprintVersion", "isDeleted", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Element_answer_collection_deleted_id_idx"
ON "public"."Element"("answerCollectionId", "isDeleted", "id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Element_repair_fpv_deleted_id_idx"
ON "public"."Element"("importFingerprintVersion", "isDeleted", "id");

DO $$
DECLARE
    expected_name TEXT;
    expected_definition TEXT;
    actual_definition TEXT;
    index_is_ready BOOLEAN;
    index_is_valid BOOLEAN;
BEGIN
    FOR expected_name, expected_definition IN VALUES
        ('AnswerCollection_owner_fpv_fp_idx', 'CREATE INDEX "AnswerCollection_owner_fpv_fp_idx" ON public."AnswerCollection" USING btree ("ownerId", "importFingerprintVersion", "importFingerprint")'),
        ('Element_owner_fpv_fp_idx', 'CREATE INDEX "Element_owner_fpv_fp_idx" ON public."Element" USING btree ("ownerId", "importFingerprintVersion", "importFingerprint")'),
        ('AnswerCollection_owner_fpv_fp_id_idx', 'CREATE INDEX "AnswerCollection_owner_fpv_fp_id_idx" ON public."AnswerCollection" USING btree ("ownerId", "importFingerprintVersion", "importFingerprint", "isDeleted", id)'),
        ('Element_owner_fpv_fp_id_idx', 'CREATE INDEX "Element_owner_fpv_fp_id_idx" ON public."Element" USING btree ("ownerId", "importFingerprintVersion", "importFingerprint", "isDeleted", id)'),
        ('AnswerCollection_repair_fpv_deleted_id_idx', 'CREATE INDEX "AnswerCollection_repair_fpv_deleted_id_idx" ON public."AnswerCollection" USING btree ("importFingerprintVersion", "isDeleted", id)'),
        ('Element_answer_collection_deleted_id_idx', 'CREATE INDEX "Element_answer_collection_deleted_id_idx" ON public."Element" USING btree ("answerCollectionId", "isDeleted", id)'),
        ('Element_repair_fpv_deleted_id_idx', 'CREATE INDEX "Element_repair_fpv_deleted_id_idx" ON public."Element" USING btree ("importFingerprintVersion", "isDeleted", id)')
    LOOP
        actual_definition := NULL;
        index_is_ready := NULL;
        index_is_valid := NULL;

        SELECT pg_get_indexdef(indexrelid), indisready, indisvalid
        INTO actual_definition, index_is_ready, index_is_valid
        FROM pg_index
        WHERE indexrelid = to_regclass(format('public.%I', expected_name));

        IF actual_definition IS DISTINCT FROM expected_definition
           OR index_is_ready IS DISTINCT FROM TRUE
           OR index_is_valid IS DISTINCT FROM TRUE THEN
            RAISE EXCEPTION '% is missing or has an incompatible or invalid definition', expected_name;
        END IF;
    END LOOP;
END $$;

-- Keep durable-state constraint replacement and its canonical-expression seal
-- atomic. The preceding idempotent index work intentionally remains committed
-- if a later validation discovers malformed durable state.
BEGIN;

-- Tighten durable-state invariants that previously relied on comparisons and
-- regular-expression matches to reject NULL values. PostgreSQL considers a
-- CHECK satisfied when its expression evaluates to NULL, so the old
-- constraints admitted incomplete READY artifacts and COMPLETE receipts.
--
-- Add and validate the corrected constraints before replacing the published
-- names. This keeps the old checks active while existing rows are scanned and
-- fails deployment instead of silently blessing malformed durable state.
ALTER TABLE "public"."ImportExportPackageArtifact"
ADD CONSTRAINT "PackageArtifact_state_fields_check_v2" CHECK (
    (
        "state" IN ('PENDING', 'UPLOADING')
        AND "reservedBytes" > 0
        AND "bytes" IS NULL
        AND "sha256" IS NULL
        AND "completedAt" IS NULL
    )
    OR (
        "state" = 'READY'
        AND "bytes" IS NOT NULL
        AND "sha256" IS NOT NULL
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
) NOT VALID;

ALTER TABLE "public"."ImportExportPackageArtifact"
VALIDATE CONSTRAINT "PackageArtifact_state_fields_check_v2";

ALTER TABLE "public"."ImportExportPackageArtifact"
DROP CONSTRAINT "PackageArtifact_state_fields_check";

ALTER TABLE "public"."ImportExportPackageArtifact"
RENAME CONSTRAINT "PackageArtifact_state_fields_check_v2"
TO "PackageArtifact_state_fields_check";

ALTER TABLE "public"."ElementImportReceipt"
ADD CONSTRAINT "ElementImportReceipt_state_fields_check_v2" CHECK (
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
        AND "retentionExpiresAt" IS NOT NULL
        AND "retentionExpiresAt" > "completedAt"
        AND jsonb_array_length("createdElementIds") > 0
    )
) NOT VALID;

ALTER TABLE "public"."ElementImportReceipt"
VALIDATE CONSTRAINT "ElementImportReceipt_state_fields_check_v2";

ALTER TABLE "public"."ElementImportReceipt"
DROP CONSTRAINT "ElementImportReceipt_state_fields_check";

ALTER TABLE "public"."ElementImportReceipt"
RENAME CONSTRAINT "ElementImportReceipt_state_fields_check_v2"
TO "ElementImportReceipt_state_fields_check";

-- Recreate the intended CHECK expressions on empty temporary reference tables.
-- Comparing PostgreSQL's own deparser output avoids version-specific strings
-- while preventing an already-weakened live constraint from being blessed.
-- PostgreSQL removes a constraint comment when its constraint is dropped, so
-- the resulting seal also detects later drop/recreate drift.
DO $seal$
DECLARE
    live_table TEXT;
    expected_table TEXT;
    expected_constraint TEXT;
    live_expression TEXT;
    expected_expression TEXT;
BEGIN
    CREATE TEMP TABLE "__ExpectedPackageArtifactChecks" (
        "state" "public"."ImportExportPackageArtifactState",
        "storageContainer" TEXT,
        "storageBlob" TEXT,
        "reservedBytes" INTEGER,
        "bytes" INTEGER,
        "sha256" TEXT,
        "expiresAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3),
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
                AND "bytes" IS NOT NULL
                AND "sha256" IS NOT NULL
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
    ) ON COMMIT DROP;

    CREATE TEMP TABLE "__ExpectedElementImportReceiptChecks" (
        "sourceArtifactId" UUID,
        "artifactRecordId" UUID,
        "packageHash" TEXT,
        "selectionDigest" TEXT,
        "selectedElementRefs" JSONB,
        "state" "public"."ElementImportReceiptState",
        "leaseId" UUID,
        "leaseExpiresAt" TIMESTAMP(3),
        "createdElementIds" JSONB,
        "createdAnswerCollectionIds" JSONB,
        "completedAt" TIMESTAMP(3),
        "retentionExpiresAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3),
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
                AND "retentionExpiresAt" IS NOT NULL
                AND "retentionExpiresAt" > "completedAt"
                AND jsonb_array_length("createdElementIds") > 0
            )
        )
    ) ON COMMIT DROP;

    CREATE TEMP TABLE "__ExpectedImportMediaStagingChecks" (
        "contentHash" TEXT,
        "storageContainer" TEXT,
        "storageBlob" TEXT,
        "state" "public"."ImportMediaStagingState",
        "createdBlob" BOOLEAN,
        "expiresAt" TIMESTAMP(3),
        "mediaFileId" UUID,
        "createdAt" TIMESTAMP(3),
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
            OR ("state" = 'FINALIZED' AND "createdBlob")
            OR ("state" = 'CLEANUP_PENDING' AND "mediaFileId" IS NULL)
        )
    ) ON COMMIT DROP;

    CREATE TEMP TABLE "__ExpectedMediaFileChecks" (
        "contentHash" TEXT,
        "importFingerprintVersion" INTEGER,
        CONSTRAINT "MediaFile_contentHash_check" CHECK ("contentHash" IS NULL OR "contentHash" ~ '^[0-9a-f]{64}$'),
        CONSTRAINT "MediaFile_importFingerprintVersion_check" CHECK ("importFingerprintVersion" IS NULL OR "importFingerprintVersion" > 0)
    ) ON COMMIT DROP;

    CREATE TEMP TABLE "__ExpectedElementChecks" (
        "importFingerprintVersion" INTEGER,
        CONSTRAINT "Element_importFingerprintVersion_check" CHECK ("importFingerprintVersion" IS NULL OR "importFingerprintVersion" > 0)
    ) ON COMMIT DROP;

    CREATE TEMP TABLE "__ExpectedAnswerCollectionChecks" (
        "importFingerprintVersion" INTEGER,
        CONSTRAINT "AnswerCollection_importFingerprintVersion_check" CHECK ("importFingerprintVersion" IS NULL OR "importFingerprintVersion" > 0)
    ) ON COMMIT DROP;

    FOR live_table, expected_constraint, expected_table IN VALUES
        ('ImportExportPackageArtifact', 'PackageArtifact_storage_target_check', '__ExpectedPackageArtifactChecks'),
        ('ImportExportPackageArtifact', 'PackageArtifact_expiry_check', '__ExpectedPackageArtifactChecks'),
        ('ImportExportPackageArtifact', 'PackageArtifact_state_fields_check', '__ExpectedPackageArtifactChecks'),
        ('ElementImportReceipt', 'ElementImportReceipt_artifact_match_check', '__ExpectedElementImportReceiptChecks'),
        ('ElementImportReceipt', 'ElementImportReceipt_hashes_check', '__ExpectedElementImportReceiptChecks'),
        ('ElementImportReceipt', 'ElementImportReceipt_arrays_check', '__ExpectedElementImportReceiptChecks'),
        ('ElementImportReceipt', 'ElementImportReceipt_state_fields_check', '__ExpectedElementImportReceiptChecks'),
        ('ImportMediaStaging', 'ImportMediaStaging_storage_target_check', '__ExpectedImportMediaStagingChecks'),
        ('ImportMediaStaging', 'ImportMediaStaging_content_hash_check', '__ExpectedImportMediaStagingChecks'),
        ('ImportMediaStaging', 'ImportMediaStaging_expiry_check', '__ExpectedImportMediaStagingChecks'),
        ('ImportMediaStaging', 'ImportMediaStaging_state_fields_check', '__ExpectedImportMediaStagingChecks'),
        ('MediaFile', 'MediaFile_contentHash_check', '__ExpectedMediaFileChecks'),
        ('MediaFile', 'MediaFile_importFingerprintVersion_check', '__ExpectedMediaFileChecks'),
        ('Element', 'Element_importFingerprintVersion_check', '__ExpectedElementChecks'),
        ('AnswerCollection', 'AnswerCollection_importFingerprintVersion_check', '__ExpectedAnswerCollectionChecks')
    LOOP
        live_expression := NULL;
        expected_expression := NULL;

        SELECT pg_get_expr(
            constraint_state.conbin,
            constraint_state.conrelid,
            true
        )
        INTO live_expression
        FROM pg_constraint constraint_state
        JOIN pg_class table_state ON table_state.oid = constraint_state.conrelid
        JOIN pg_namespace table_namespace ON table_namespace.oid = table_state.relnamespace
        WHERE table_namespace.nspname = 'public'
          AND table_state.relname = live_table
          AND constraint_state.conname = expected_constraint
          AND constraint_state.contype = 'c';

        SELECT pg_get_expr(
            constraint_state.conbin,
            constraint_state.conrelid,
            true
        )
        INTO expected_expression
        FROM pg_constraint constraint_state
        JOIN pg_class table_state ON table_state.oid = constraint_state.conrelid
        JOIN pg_namespace table_namespace ON table_namespace.oid = table_state.relnamespace
        WHERE table_namespace.oid = pg_my_temp_schema()
          AND table_state.relname = expected_table
          AND constraint_state.conname = expected_constraint
          AND constraint_state.contype = 'c';

        IF live_expression IS DISTINCT FROM expected_expression
           OR expected_expression IS NULL THEN
            RAISE EXCEPTION '% on public.% is missing or has an incompatible definition', expected_constraint, live_table;
        END IF;

        EXECUTE format(
            'COMMENT ON CONSTRAINT %I ON public.%I IS %L',
            expected_constraint,
            live_table,
            'klicker-import-export-check-v1:' || live_expression
        );
    END LOOP;
END $seal$;

COMMIT;
