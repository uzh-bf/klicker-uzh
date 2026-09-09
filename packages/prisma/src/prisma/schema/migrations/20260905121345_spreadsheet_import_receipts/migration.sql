BEGIN;

-- AlterTable
ALTER TABLE "ElementImportReceipt" ADD COLUMN     "skippedElementRefs" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Empty created IDs are a successful result when every selected row was a duplicate.
ALTER TABLE "public"."ElementImportReceipt"
  DROP CONSTRAINT "ElementImportReceipt_state_fields_check",
  ADD CONSTRAINT "ElementImportReceipt_state_fields_check" CHECK ("skippedElementRefs" IS NOT NULL AND (
        (
            "state" = 'PENDING'
            AND "leaseId" IS NOT NULL
            AND "leaseExpiresAt" IS NOT NULL
            AND "leaseExpiresAt" > "createdAt"
            AND "completedAt" IS NULL
            AND "retentionExpiresAt" IS NULL
            AND jsonb_array_length("createdElementIds") = 0
            AND jsonb_array_length("createdAnswerCollectionIds") = 0
            AND cardinality("skippedElementRefs") = 0
        )
        OR (
            "state" = 'COMPLETE'
            AND "leaseId" IS NULL
            AND "leaseExpiresAt" IS NULL
            AND "completedAt" IS NOT NULL
            AND "retentionExpiresAt" IS NOT NULL
            AND "retentionExpiresAt" > "completedAt"
            AND jsonb_array_length("createdElementIds") + cardinality("skippedElementRefs") > 0
        )
    ));

-- Completed import results are the authoritative exactly-once replay record.
CREATE OR REPLACE FUNCTION "public"."prevent_completed_import_receipt_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."state" = 'COMPLETE' AND (
        NEW."state" IS DISTINCT FROM OLD."state"
        OR NEW."skippedElementRefs" IS DISTINCT FROM OLD."skippedElementRefs"
        OR NEW."createdElementIds" IS DISTINCT FROM OLD."createdElementIds"
        OR NEW."createdAnswerCollectionIds" IS DISTINCT FROM OLD."createdAnswerCollectionIds"
        OR NEW."completedAt" IS DISTINCT FROM OLD."completedAt"
        OR NEW."retentionExpiresAt" IS DISTINCT FROM OLD."retentionExpiresAt"
    ) THEN
        RAISE EXCEPTION 'Completed import receipt result is immutable'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'ElementImportReceipt_result_immutable';
    END IF;
    RETURN NEW;
END;
$$;

-- The operations readiness inspector verifies PostgreSQL's canonical check
-- expression against this seal, which is lost when replacing a constraint.
DO $seal$
DECLARE expression text;
BEGIN
    SELECT pg_get_expr(conbin, conrelid, true) INTO STRICT expression
    FROM pg_constraint
    WHERE conrelid = 'public."ElementImportReceipt"'::regclass
      AND conname = 'ElementImportReceipt_state_fields_check';
    EXECUTE format(
        'COMMENT ON CONSTRAINT "ElementImportReceipt_state_fields_check" ON public."ElementImportReceipt" IS %L',
        'klicker-import-export-check-v1:' || expression
    );
END $seal$;

COMMIT;
