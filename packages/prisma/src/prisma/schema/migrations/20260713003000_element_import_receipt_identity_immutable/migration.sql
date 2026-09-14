-- An import token's durable identity must not be rebound after the receipt is
-- created. artifactRecordId remains intentionally mutable so expiry cleanup
-- can detach the short-lived artifact through ON DELETE SET NULL.
CREATE FUNCTION "public"."prevent_element_import_receipt_identity_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."jti" IS DISTINCT FROM OLD."jti"
       OR NEW."sourceArtifactId" IS DISTINCT FROM OLD."sourceArtifactId"
       OR NEW."packageHash" IS DISTINCT FROM OLD."packageHash"
       OR NEW."selectionDigest" IS DISTINCT FROM OLD."selectionDigest"
       OR NEW."selectedElementRefs" IS DISTINCT FROM OLD."selectedElementRefs" THEN
        RAISE EXCEPTION 'Import receipt identity is immutable'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'ElementImportReceipt_identity_immutable';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "ElementImportReceipt_identity_immutable_trigger"
BEFORE UPDATE OF "jti", "sourceArtifactId", "packageHash", "selectionDigest", "selectedElementRefs"
ON "public"."ElementImportReceipt"
FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_element_import_receipt_identity_change"();
