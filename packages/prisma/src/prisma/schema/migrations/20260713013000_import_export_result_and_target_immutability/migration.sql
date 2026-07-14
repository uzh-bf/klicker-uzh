-- Completed import results are the authoritative exactly-once replay record.
CREATE FUNCTION "public"."prevent_completed_import_receipt_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."state" = 'COMPLETE' AND (
        NEW."state" IS DISTINCT FROM OLD."state"
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

CREATE TRIGGER "ElementImportReceipt_result_immutable_trigger"
BEFORE UPDATE
ON "public"."ElementImportReceipt"
FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_completed_import_receipt_change"();

-- Cleanup trusts these fields as the immutable identity of an exact blob.
CREATE FUNCTION "public"."prevent_import_media_staging_identity_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."receiptId" IS DISTINCT FROM OLD."receiptId"
       OR NEW."ownerId" IS DISTINCT FROM OLD."ownerId"
       OR NEW."contentHash" IS DISTINCT FROM OLD."contentHash"
       OR NEW."storageContainer" IS DISTINCT FROM OLD."storageContainer"
       OR NEW."storageBlob" IS DISTINCT FROM OLD."storageBlob" THEN
        RAISE EXCEPTION 'Import media staging identity is immutable'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'ImportMediaStaging_identity_immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "ImportMediaStaging_identity_immutable_trigger"
BEFORE UPDATE
ON "public"."ImportMediaStaging"
FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_import_media_staging_identity_change"();

-- Artifact cleanup and import pinning coordinate through this exact target.
CREATE FUNCTION "public"."prevent_package_artifact_target_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW."direction" IS DISTINCT FROM OLD."direction"
       OR NEW."ownerId" IS DISTINCT FROM OLD."ownerId"
       OR NEW."storageContainer" IS DISTINCT FROM OLD."storageContainer"
       OR NEW."storageBlob" IS DISTINCT FROM OLD."storageBlob" THEN
        RAISE EXCEPTION 'Import/export package artifact target is immutable'
            USING ERRCODE = '23514',
                  CONSTRAINT = 'PackageArtifact_target_immutable';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "PackageArtifact_target_immutable_trigger"
BEFORE UPDATE
ON "public"."ImportExportPackageArtifact"
FOR EACH ROW
EXECUTE FUNCTION "public"."prevent_package_artifact_target_change"();
