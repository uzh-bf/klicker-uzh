-- CreateEnum
CREATE TYPE "PermissionOperationType" AS ENUM ('EXPAND_GROUP_TO_USER_GRANT_OPERATIONS', 'EXPAND_GROUP_TO_USER_UPDATE_OPERATIONS', 'EXPAND_GROUP_TO_USER_REVOKE_OPERATIONS', 'PROCESS_USER_ELEMENT_ACCESS', 'PROCESS_USER_ANSWER_COLLECTION_ACCESS', 'PROCESS_USER_COURSE_ACCESS', 'PROCESS_USER_LIVE_QUIZ_ACCESS', 'PROCESS_USER_PRACTICE_QUIZ_ACCESS', 'PROCESS_USER_MICROLEARNING_ACCESS', 'PROCESS_USER_GROUP_ACTIVITY_ACCESS', 'PROCESS_USER_CATALOG_COLLECTION_ACCESS', 'UPDATE_PERMISSION_LEVEL', 'REVOKE_USER_PERMISSION');

-- CreateEnum
CREATE TYPE "PermissionOperationStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "PendingPermissionOperation" (
    "id" SERIAL NOT NULL,
    "operationType" "PermissionOperationType" NOT NULL,
    "status" "PermissionOperationStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "targetUserId" UUID,
    "targetGroupId" INTEGER,
    "objectId" TEXT NOT NULL,
    "objectType" "ObjectType" NOT NULL,
    "permissionLevel" "PermissionLevel",
    "oldPermissionLevel" "PermissionLevel",
    "directPermissionId" INTEGER,
    "parentOperationId" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "operationFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "PendingPermissionOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingPermissionOperation_operationFingerprint_key" ON "PendingPermissionOperation"("operationFingerprint");

-- CreateIndex
CREATE INDEX "PendingPermissionOperation_status_priority_idx" ON "PendingPermissionOperation"("status", "priority");

-- CreateIndex
CREATE INDEX "PendingPermissionOperation_directPermissionId_idx" ON "PendingPermissionOperation"("directPermissionId");

-- CreateIndex
CREATE INDEX "PendingPermissionOperation_parentOperationId_idx" ON "PendingPermissionOperation"("parentOperationId");

-- CreateIndex
CREATE INDEX "PendingPermissionOperation_targetUserId_objectId_objectType_idx" ON "PendingPermissionOperation"("targetUserId", "objectId", "objectType");

-- CreateIndex
CREATE INDEX "PendingPermissionOperation_targetGroupId_objectId_objectTyp_idx" ON "PendingPermissionOperation"("targetGroupId", "objectId", "objectType");

-- CreateIndex
CREATE INDEX "PendingPermissionOperation_operationFingerprint_idx" ON "PendingPermissionOperation"("operationFingerprint");

-- CreateIndex
CREATE INDEX "PendingPermissionOperation_status_createdAt_idx" ON "PendingPermissionOperation"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PendingPermissionOperation" ADD CONSTRAINT "PendingPermissionOperation_directPermissionId_fkey" FOREIGN KEY ("directPermissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingPermissionOperation" ADD CONSTRAINT "PendingPermissionOperation_parentOperationId_fkey" FOREIGN KEY ("parentOperationId") REFERENCES "PendingPermissionOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
