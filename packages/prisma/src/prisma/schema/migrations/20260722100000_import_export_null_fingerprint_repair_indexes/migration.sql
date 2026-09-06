-- CreateIndex
-- Active rows with a current version but a null fingerprint remain dirty. Keep
-- that repair branch bounded without changing the already-published repair
-- migration. Large environments may pre-create these exact indexes
-- concurrently before migrate deploy; the validation block rejects an
-- incompatible or incomplete same-name relation after an IF NOT EXISTS no-op.
CREATE INDEX IF NOT EXISTS "AnswerCollection_repair_null_fp_id_idx"
ON "public"."AnswerCollection"("id")
WHERE "isDeleted" = false AND "importFingerprint" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Element_repair_null_fp_id_idx"
ON "public"."Element"("id")
WHERE "isDeleted" = false AND "importFingerprint" IS NULL;

DO $$
DECLARE
    expected_name TEXT;
    expected_definition TEXT;
    actual_definition TEXT;
    index_is_ready BOOLEAN;
    index_is_valid BOOLEAN;
BEGIN
    FOR expected_name, expected_definition IN VALUES
        ('AnswerCollection_repair_null_fp_id_idx', 'CREATE INDEX "AnswerCollection_repair_null_fp_id_idx" ON public."AnswerCollection" USING btree (id) WHERE (("isDeleted" = false) AND ("importFingerprint" IS NULL))'),
        ('Element_repair_null_fp_id_idx', 'CREATE INDEX "Element_repair_null_fp_id_idx" ON public."Element" USING btree (id) WHERE (("isDeleted" = false) AND ("importFingerprint" IS NULL))')
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
