-- CreateEnum
CREATE TYPE "public"."KBIngestionStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "public"."KBResource" ADD COLUMN     "activeContentSha256" TEXT,
ADD COLUMN     "activeResourceVersion" INTEGER,
ADD COLUMN     "errorCode" TEXT;

-- Preserve the serving state already proven by the W2 READY invariant.
UPDATE "public"."KBResource"
SET
    "activeResourceVersion" = "resourceVersion",
    "activeContentSha256" = "contentSha256"
WHERE
    "status" = 'READY'
    AND "resourceVersion" > 0
    AND "contentSha256" IS NOT NULL;

-- CreateTable
CREATE TABLE "public"."KBIngestionRun" (
    "id" UUID NOT NULL,
    "status" "public"."KBIngestionStatus" NOT NULL DEFAULT 'QUEUED',
    "resourceVersion" INTEGER NOT NULL,
    "contentSha256" TEXT,
    "externalOperationId" TEXT,
    "statusMessage" TEXT,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "resourceId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KBIngestionRun_pkey" PRIMARY KEY ("id")
);

-- Preserve the latest W2 attempt as the first entry in the durable ledger.
INSERT INTO "public"."KBIngestionRun" (
    "id",
    "status",
    "resourceVersion",
    "contentSha256",
    "externalOperationId",
    "statusMessage",
    "startedAt",
    "finishedAt",
    "resourceId",
    "createdAt",
    "updatedAt"
)
SELECT
    "ingestionAttemptId",
    CASE "status"
        WHEN 'QUEUED' THEN 'QUEUED'
        WHEN 'PROCESSING' THEN 'PROCESSING'
        WHEN 'READY' THEN 'SUCCEEDED'
        WHEN 'FAILED' THEN 'FAILED'
        ELSE 'QUEUED'
    END::"public"."KBIngestionStatus",
    "resourceVersion",
    "contentSha256",
    "externalOperationId",
    "statusMessage",
    "externalOperationStartedAt",
    CASE
        WHEN "status" = 'READY' THEN COALESCE("ingestedAt", "updatedAt")
        WHEN "status" = 'FAILED' THEN "updatedAt"
        ELSE NULL
    END,
    "id",
    COALESCE("externalOperationStartedAt", "createdAt"),
    "updatedAt"
FROM "public"."KBResource"
WHERE "ingestionAttemptId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "KBIngestionRun_resourceId_createdAt_idx" ON "public"."KBIngestionRun"("resourceId", "createdAt");

-- CreateIndex
CREATE INDEX "KBIngestionRun_status_idx" ON "public"."KBIngestionRun"("status");

-- AddForeignKey
ALTER TABLE "public"."KBIngestionRun" ADD CONSTRAINT "KBIngestionRun_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "public"."KBResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
