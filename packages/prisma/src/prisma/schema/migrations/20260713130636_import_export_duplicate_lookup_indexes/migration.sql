-- CreateIndex
-- Large environments may pre-create this exact index with CREATE INDEX
-- CONCURRENTLY before migrate deploy. IF NOT EXISTS makes the migration a
-- no-op after that pre-step while the validation below rejects name-only
-- collisions, incomplete concurrent builds, and incompatible definitions.
CREATE INDEX IF NOT EXISTS "AnswerCollection_owner_fpv_fp_id_idx"
ON "public"."AnswerCollection"("ownerId", "importFingerprintVersion", "importFingerprint", "isDeleted", "id");

DO $$
DECLARE
    actual_definition TEXT;
    index_is_ready BOOLEAN;
    index_is_valid BOOLEAN;
BEGIN
    SELECT pg_get_indexdef(indexrelid), indisready, indisvalid
    INTO actual_definition, index_is_ready, index_is_valid
    FROM pg_index
    WHERE indexrelid = 'public."AnswerCollection_owner_fpv_fp_id_idx"'::regclass;

    IF actual_definition <> 'CREATE INDEX "AnswerCollection_owner_fpv_fp_id_idx" ON public."AnswerCollection" USING btree ("ownerId", "importFingerprintVersion", "importFingerprint", "isDeleted", id)'
       OR NOT index_is_ready
       OR NOT index_is_valid THEN
        RAISE EXCEPTION 'AnswerCollection_owner_fpv_fp_id_idx exists with an incompatible or invalid definition';
    END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Element_owner_fpv_fp_id_idx"
ON "public"."Element"("ownerId", "importFingerprintVersion", "importFingerprint", "isDeleted", "id");

DO $$
DECLARE
    actual_definition TEXT;
    index_is_ready BOOLEAN;
    index_is_valid BOOLEAN;
BEGIN
    SELECT pg_get_indexdef(indexrelid), indisready, indisvalid
    INTO actual_definition, index_is_ready, index_is_valid
    FROM pg_index
    WHERE indexrelid = 'public."Element_owner_fpv_fp_id_idx"'::regclass;

    IF actual_definition <> 'CREATE INDEX "Element_owner_fpv_fp_id_idx" ON public."Element" USING btree ("ownerId", "importFingerprintVersion", "importFingerprint", "isDeleted", id)'
       OR NOT index_is_ready
       OR NOT index_is_valid THEN
        RAISE EXCEPTION 'Element_owner_fpv_fp_id_idx exists with an incompatible or invalid definition';
    END IF;
END $$;
