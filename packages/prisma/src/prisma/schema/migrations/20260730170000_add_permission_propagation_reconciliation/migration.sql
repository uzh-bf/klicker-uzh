CREATE TYPE "PermissionPropagationCursorKind" AS ENUM ('SAMPLE', 'FULL_SWEEP');
CREATE TYPE "PermissionPropagationSignalSource" AS ENUM (
    'PERMISSION',
    'USER_GROUP',
    'DIRECT_AUDIT',
    'USER_GROUP_AUDIT',
    'ACTIVITY',
    'ELEMENT_INSTANCE',
    'CATALOG_ASSIGNMENT'
);

CREATE TABLE "PermissionPropagationReconciliationState" (
    "id" TEXT NOT NULL,
    "sampleObjectType" "ObjectType" NOT NULL DEFAULT 'CATALOG_COLLECTION',
    "fullSweepObjectType" "ObjectType" NOT NULL DEFAULT 'CATALOG_COLLECTION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionPropagationReconciliationState_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PermissionPropagationReconciliationState_sample_object_type_check"
        CHECK ("sampleObjectType" <> 'USER_GROUP'),
    CONSTRAINT "PermissionPropagationReconciliationState_full_sweep_object_type_check"
        CHECK ("fullSweepObjectType" <> 'USER_GROUP')
);

CREATE TABLE "PermissionPropagationCursor" (
    "kind" "PermissionPropagationCursorKind" NOT NULL,
    "objectType" "ObjectType" NOT NULL,
    "objectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionPropagationCursor_pkey" PRIMARY KEY ("kind", "objectType"),
    CONSTRAINT "PermissionPropagationCursor_object_type_check"
        CHECK ("objectType" <> 'USER_GROUP'),
    CONSTRAINT "PermissionPropagationCursor_object_id_check"
        CHECK ("objectId" IS NULL OR length("objectId") > 0)
);

CREATE TABLE "PermissionPropagationSignalCursor" (
    "source" "PermissionPropagationSignalSource" NOT NULL,
    "through" TIMESTAMP(3) NOT NULL,
    "sourceId" INTEGER,
    "relationId" INTEGER,
    "relationMaxId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionPropagationSignalCursor_pkey" PRIMARY KEY ("source"),
    CONSTRAINT "PermissionPropagationSignalCursor_position_check"
        CHECK (
            (
                "sourceId" IS NULL
                AND "relationId" IS NULL
                AND "relationMaxId" IS NULL
            )
            OR (
                "sourceId" IS NOT NULL
                AND "sourceId" > 0
                AND "relationId" IS NOT NULL
                AND "relationId" >= 0
                AND (
                    "relationMaxId" IS NULL
                    OR (
                        "source" IN ('USER_GROUP', 'USER_GROUP_AUDIT')
                        AND "relationMaxId" >= "relationId"
                    )
                )
            )
        )
);

CREATE INDEX "PermissionPropagationWork_unresolved_lastDispatchedAt_key_idx"
    ON "PermissionPropagationWork"("lastDispatchedAt", "key")
    WHERE "processedGeneration" < "generation";

CREATE INDEX "UserGroup_updatedAt_id_idx" ON "UserGroup"("updatedAt", "id");
CREATE INDEX "Permission_updatedAt_id_idx" ON "Permission"("updatedAt", "id");
CREATE INDEX "Permission_userGroupId_id_idx" ON "Permission"("userGroupId", "id");
CREATE INDEX "AuditLogEntry_createdAt_idx" ON "AuditLogEntry"("createdAt");
CREATE INDEX "AuditLogEntry_objectType_createdAt_id_idx"
    ON "AuditLogEntry"("objectType", "createdAt", "id");
CREATE INDEX "ActivityLogEntry_updatedAt_id_idx" ON "ActivityLogEntry"("updatedAt", "id");
CREATE INDEX "ElementInstance_updatedAt_id_idx" ON "ElementInstance"("updatedAt", "id");
CREATE INDEX "CatalogCollectionAssignment_updatedAt_id_idx"
    ON "CatalogCollectionAssignment"("updatedAt", "id");
