-- CreateEnum
CREATE TYPE "PermissionPropagationMode" AS ENUM ('OBJECT', 'USER');

-- CreateEnum
CREATE TYPE "PermissionPropagationFailureCode" AS ENUM ('WORKER_EXECUTION_FAILED', 'DISPATCH_FAILED', 'RECOVERY_SLO_BREACHED');

-- CreateTable
CREATE TABLE "PermissionPropagationWork" (
    "key" TEXT NOT NULL,
    "objectType" "ObjectType" NOT NULL,
    "objectId" TEXT NOT NULL,
    "mode" "PermissionPropagationMode" NOT NULL,
    "userId" UUID,
    "generation" BIGINT NOT NULL DEFAULT 1,
    "processedGeneration" BIGINT NOT NULL DEFAULT 0,
    "dispatchedGeneration" BIGINT NOT NULL DEFAULT 0,
    "updateAccessRequests" BOOLEAN NOT NULL DEFAULT false,
    "lastDispatchedAt" TIMESTAMP(3),
    "dirtyAt" TIMESTAMP(3) NOT NULL,
    "recoverBy" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PermissionPropagationWork_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "PermissionPropagationWork_supported_object_type_check"
        CHECK ("objectType" <> 'USER_GROUP'),
    CONSTRAINT "PermissionPropagationWork_mode_user_check"
        CHECK (
            ("mode" = 'OBJECT' AND "userId" IS NULL)
            OR ("mode" = 'USER' AND "userId" IS NOT NULL)
        ),
    CONSTRAINT "PermissionPropagationWork_object_id_check"
        CHECK (octet_length("objectId") > 0),
    CONSTRAINT "PermissionPropagationWork_generation_check"
        CHECK (
            "generation" >= 1
            AND "processedGeneration" >= 0
            AND "processedGeneration" <= "generation"
            AND "dispatchedGeneration" >= 0
            AND "dispatchedGeneration" <= "generation"
        ),
    CONSTRAINT "PermissionPropagationWork_recovery_window_check"
        CHECK ("recoverBy" >= "dirtyAt"),
    CONSTRAINT "PermissionPropagationWork_key_check"
        CHECK (
            "key" =
                octet_length("objectType"::text)::text || ':' || "objectType"::text ||
                octet_length("objectId")::text || ':' || "objectId" ||
                octet_length("mode"::text)::text || ':' || "mode"::text ||
                CASE
                    WHEN "userId" IS NULL THEN '-:'
                    ELSE octet_length("userId"::text)::text || ':' || "userId"::text
                END
        )
);

-- CreateTable
CREATE TABLE "PermissionPropagationFailure" (
    "workKey" TEXT NOT NULL,
    "generation" BIGINT NOT NULL,
    "code" "PermissionPropagationFailureCode" NOT NULL,
    "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PermissionPropagationFailure_pkey" PRIMARY KEY ("workKey", "generation", "code")
);

-- CreateIndex
CREATE INDEX "PermissionPropagationWork_objectType_objectId_idx" ON "PermissionPropagationWork"("objectType", "objectId");

-- The reconciler scans unresolved work in recovery-deadline order.
CREATE INDEX "PermissionPropagationWork_unresolved_recoverBy_key_idx"
    ON "PermissionPropagationWork"("recoverBy", "key")
    WHERE "processedGeneration" < "generation";

-- CreateIndex
CREATE INDEX "PermissionPropagationFailure_failedAt_idx" ON "PermissionPropagationFailure"("failedAt");

-- AddForeignKey
ALTER TABLE "PermissionPropagationFailure" ADD CONSTRAINT "PermissionPropagationFailure_workKey_fkey" FOREIGN KEY ("workKey") REFERENCES "PermissionPropagationWork"("key") ON DELETE RESTRICT ON UPDATE CASCADE;
