-- CreateEnum
CREATE TYPE "AssessmentAuditCoverageState" AS ENUM ('UNCOVERED', 'ACTIVATING', 'COVERED', 'EXCLUDED_TERMINAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AssessmentAuditBaselineKind" AS ENUM ('CREATION', 'ROLLOUT_CONFIGURATION_CURRENT_STATE', 'REOPENING');

-- CreateEnum
CREATE TYPE "AssessmentAuditRolloutOutcome" AS ENUM ('PENDING', 'ACTIVATED', 'ROLLOUT_BASELINED', 'EXCLUDED_TERMINAL', 'FAILED');

-- CreateEnum
CREATE TYPE "AssessmentAuditDeliveryState" AS ENUM ('PENDING', 'LEASED', 'DELIVERED_UNSEALED', 'SEALED', 'QUARANTINED');

-- CreateEnum
CREATE TYPE "AssessmentAuditEmissionPath" AS ENUM ('LANE_1_OUTBOX', 'LANE_2_HATCHET', 'CLIENT_INGRESS', 'OWNER_CLI');

-- CreateEnum
CREATE TYPE "AssessmentAuditEvidenceClass" AS ENUM ('AUTHORITATIVE', 'SERVER_OBSERVED', 'CLIENT_OBSERVED', 'ADMINISTRATIVE');

-- CreateEnum
CREATE TYPE "AssessmentAuditCriticality" AS ENUM ('CRITICAL', 'STANDARD');

-- CreateEnum
CREATE TYPE "AssessmentAuditRecordedVia" AS ENUM ('TRANSACTIONAL_OUTBOX', 'CLIENT_QUEUE_DRAINER', 'HATCHET_PROCESSOR', 'OWNER_CLI', 'AUDIT_SERVICE');

-- CreateTable
CREATE TABLE "AssessmentAuditScope" (
    "liveQuizId" UUID NOT NULL,
    "lifecycleEpoch" INTEGER NOT NULL,
    "coverageState" "AssessmentAuditCoverageState" NOT NULL,
    "baselineId" UUID,
    "baselineKind" "AssessmentAuditBaselineKind",
    "activatedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "deletedAt" TIMESTAMPTZ(3),
    "retentionAnchorAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AssessmentAuditScope_pkey" PRIMARY KEY ("liveQuizId","lifecycleEpoch")
);

-- CreateTable
CREATE TABLE "AssessmentAuditRolloutInventory" (
    "scanId" UUID NOT NULL,
    "liveQuizId" UUID NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "observedLifecycleState" VARCHAR(128) NOT NULL,
    "outcome" "AssessmentAuditRolloutOutcome" NOT NULL DEFAULT 'PENDING',
    "stableReason" VARCHAR(128),
    "rolloutEventId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AssessmentAuditRolloutInventory_pkey" PRIMARY KEY ("scanId","liveQuizId")
);

-- CreateTable
CREATE TABLE "AssessmentAuditOutboxEvent" (
    "eventId" UUID NOT NULL,
    "idempotencyKey" CHAR(64) NOT NULL,
    "eventHash" CHAR(64) NOT NULL,
    "payloadHash" CHAR(64) NOT NULL,
    "schemaVersion" INTEGER NOT NULL,
    "payloadSchemaVersion" INTEGER NOT NULL,
    "eventType" VARCHAR(128) NOT NULL,
    "emissionPath" "AssessmentAuditEmissionPath" NOT NULL,
    "evidenceClass" "AssessmentAuditEvidenceClass" NOT NULL,
    "criticality" "AssessmentAuditCriticality" NOT NULL,
    "recordedVia" "AssessmentAuditRecordedVia" NOT NULL,
    "liveQuizId" UUID NOT NULL,
    "lifecycleEpoch" INTEGER NOT NULL,
    "courseId" UUID,
    "participantId" UUID,
    "correlationId" UUID NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL,
    "canonicalEnvelope" TEXT NOT NULL,
    "canonicalByteLength" INTEGER NOT NULL,
    "deliveryState" "AssessmentAuditDeliveryState" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" VARCHAR(128),
    "leaseExpiresAt" TIMESTAMPTZ(3),
    "deliveredAt" TIMESTAMPTZ(3),
    "sealedAt" TIMESTAMPTZ(3),
    "quarantinedAt" TIMESTAMPTZ(3),
    "quarantineReason" VARCHAR(128),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentAuditOutboxEvent_pkey" PRIMARY KEY ("eventId")
);

-- The evidence tables intentionally have no foreign keys to business tables.
-- These checks protect invariants that Prisma's schema language cannot express.
ALTER TABLE "AssessmentAuditScope"
  ADD CONSTRAINT "AssessmentAuditScope_lifecycleEpoch_check"
    CHECK ("lifecycleEpoch" >= 0),
  ADD CONSTRAINT "AssessmentAuditScope_coverageState_check"
    CHECK (
      (
        "coverageState" = 'UNCOVERED'
        AND "baselineId" IS NULL
        AND "baselineKind" IS NULL
        AND "activatedAt" IS NULL
        AND "retentionAnchorAt" IS NULL
      )
      OR (
        "coverageState" = 'ACTIVATING'
        AND "baselineId" IS NOT NULL
        AND "baselineKind" IS NOT NULL
        AND "activatedAt" IS NULL
        AND "retentionAnchorAt" IS NULL
      )
      OR (
        "coverageState" = 'COVERED'
        AND
        "baselineId" IS NOT NULL
        AND "baselineKind" IS NOT NULL
        AND "activatedAt" IS NOT NULL
      )
      OR (
        "coverageState" = 'EXCLUDED_TERMINAL'
        AND "baselineId" IS NULL
        AND "baselineKind" IS NULL
        AND "activatedAt" IS NULL
        AND "retentionAnchorAt" IS NOT NULL
      )
      OR (
        "coverageState" = 'FAILED'
        AND "activatedAt" IS NULL
        AND (("baselineId" IS NULL) = ("baselineKind" IS NULL))
        AND "retentionAnchorAt" IS NULL
      )
    ),
  ADD CONSTRAINT "AssessmentAuditScope_retentionAnchor_check"
    CHECK (
      (
        "completedAt" IS NULL
        AND "cancelledAt" IS NULL
        AND "deletedAt" IS NULL
        AND "retentionAnchorAt" IS NULL
      )
      OR (
        "retentionAnchorAt" IS NOT NULL
        AND
        "retentionAnchorAt" = GREATEST(
          "completedAt",
          "cancelledAt",
          "deletedAt"
        )
        AND (
          "activatedAt" IS NULL
          OR "retentionAnchorAt" >= "activatedAt"
        )
      )
    ),
  ADD CONSTRAINT "AssessmentAuditScope_terminalCoverage_check"
    CHECK (
      "coverageState" <> 'EXCLUDED_TERMINAL'
      OR "retentionAnchorAt" IS NOT NULL
    );

ALTER TABLE "AssessmentAuditRolloutInventory"
  ADD CONSTRAINT "AssessmentAuditRolloutInventory_terminalEvent_check"
    CHECK (
      ("outcome" = 'PENDING' AND "rolloutEventId" IS NULL)
      OR ("outcome" <> 'PENDING' AND "rolloutEventId" IS NOT NULL)
    ),
  ADD CONSTRAINT "AssessmentAuditRolloutInventory_stableReason_check"
    CHECK (
      (
        "outcome" IN ('FAILED', 'EXCLUDED_TERMINAL')
        AND "stableReason" IS NOT NULL
      )
      OR (
        "outcome" NOT IN ('FAILED', 'EXCLUDED_TERMINAL')
        AND "stableReason" IS NULL
      )
    ),
  ADD CONSTRAINT "AssessmentAuditRolloutInventory_codes_check"
    CHECK (
      "observedLifecycleState" ~ '^[A-Z][A-Z0-9_]{1,127}$'
      AND (
        "stableReason" IS NULL
        OR "stableReason" ~ '^[A-Z][A-Z0-9_]{1,127}$'
      )
    );

ALTER TABLE "AssessmentAuditOutboxEvent"
  ADD CONSTRAINT "AssessmentAuditOutboxEvent_lifecycleEpoch_check"
    CHECK ("lifecycleEpoch" >= 0),
  ADD CONSTRAINT "AssessmentAuditOutboxEvent_schemaVersions_check"
    CHECK ("schemaVersion" >= 1 AND "payloadSchemaVersion" >= 1),
  ADD CONSTRAINT "AssessmentAuditOutboxEvent_attemptCount_check"
    CHECK ("attemptCount" >= 0),
  ADD CONSTRAINT "AssessmentAuditOutboxEvent_recordedAt_check"
    CHECK ("recordedAt" >= "receivedAt"),
  ADD CONSTRAINT "AssessmentAuditOutboxEvent_canonicalByteLength_check"
    CHECK (
      "canonicalByteLength" > 0
      AND "canonicalByteLength" = octet_length("canonicalEnvelope")
    ),
  ADD CONSTRAINT "AssessmentAuditOutboxEvent_hashes_check"
    CHECK (
      "idempotencyKey" ~ '^[0-9a-f]{64}$'
      AND "eventHash" ~ '^[0-9a-f]{64}$'
      AND "payloadHash" ~ '^[0-9a-f]{64}$'
    ),
  ADD CONSTRAINT "AssessmentAuditOutboxEvent_codes_check"
    CHECK (
      "eventType" ~ '^[A-Z][A-Z0-9_]{1,127}$'
      AND (
        "quarantineReason" IS NULL
        OR "quarantineReason" ~ '^[A-Z][A-Z0-9_]{1,127}$'
      )
    ),
  ADD CONSTRAINT "AssessmentAuditOutboxEvent_deliveryState_check"
    CHECK (
      (
        "deliveryState" = 'PENDING'
        AND "leaseOwner" IS NULL
        AND "leaseExpiresAt" IS NULL
        AND "deliveredAt" IS NULL
        AND "sealedAt" IS NULL
        AND "quarantinedAt" IS NULL
        AND "quarantineReason" IS NULL
      )
      OR (
        "deliveryState" = 'LEASED'
        AND "leaseOwner" IS NOT NULL
        AND "leaseExpiresAt" IS NOT NULL
        AND "deliveredAt" IS NULL
        AND "sealedAt" IS NULL
        AND "quarantinedAt" IS NULL
        AND "quarantineReason" IS NULL
      )
      OR (
        "deliveryState" = 'DELIVERED_UNSEALED'
        AND "leaseOwner" IS NULL
        AND "leaseExpiresAt" IS NULL
        AND "deliveredAt" IS NOT NULL
        AND "deliveredAt" >= "recordedAt"
        AND "sealedAt" IS NULL
        AND "quarantinedAt" IS NULL
        AND "quarantineReason" IS NULL
      )
      OR (
        "deliveryState" = 'SEALED'
        AND "leaseOwner" IS NULL
        AND "leaseExpiresAt" IS NULL
        AND "deliveredAt" IS NOT NULL
        AND "sealedAt" IS NOT NULL
        AND "deliveredAt" >= "recordedAt"
        AND "sealedAt" >= "deliveredAt"
        AND "quarantinedAt" IS NULL
        AND "quarantineReason" IS NULL
      )
      OR (
        "deliveryState" = 'QUARANTINED'
        AND "leaseOwner" IS NULL
        AND "leaseExpiresAt" IS NULL
        AND "deliveredAt" IS NULL
        AND "sealedAt" IS NULL
        AND "quarantinedAt" IS NOT NULL
        AND "quarantinedAt" >= "recordedAt"
        AND "quarantineReason" IS NOT NULL
      )
    );

-- CreateIndex
CREATE INDEX "AssessmentAuditScope_coverageState_activatedAt_idx" ON "AssessmentAuditScope"("coverageState", "activatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAuditScope_baselineId_key" ON "AssessmentAuditScope"("baselineId");

-- CreateIndex
CREATE INDEX "AssessmentAuditScope_retentionAnchorAt_idx" ON "AssessmentAuditScope"("retentionAnchorAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAuditRolloutInventory_rolloutEventId_key" ON "AssessmentAuditRolloutInventory"("rolloutEventId");

-- CreateIndex
CREATE INDEX "AssessmentAuditRolloutInventory_scanId_outcome_idx" ON "AssessmentAuditRolloutInventory"("scanId", "outcome");

-- CreateIndex
CREATE INDEX "AssessmentAuditRolloutInventory_liveQuizId_observedAt_idx" ON "AssessmentAuditRolloutInventory"("liveQuizId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAuditOutboxEvent_idempotencyKey_key" ON "AssessmentAuditOutboxEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AssessmentAuditOutboxEvent_deliveryState_nextAttemptAt_reco_idx" ON "AssessmentAuditOutboxEvent"("deliveryState", "nextAttemptAt", "recordedAt");

-- CreateIndex
CREATE INDEX "AssessmentAuditOutboxEvent_deliveryState_leaseExpiresAt_idx" ON "AssessmentAuditOutboxEvent"("deliveryState", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "AssessmentAuditOutboxEvent_liveQuizId_lifecycleEpoch_record_idx" ON "AssessmentAuditOutboxEvent"("liveQuizId", "lifecycleEpoch", "recordedAt", "eventId");

-- CreateIndex
CREATE INDEX "AssessmentAuditOutboxEvent_deliveryState_deliveredAt_idx" ON "AssessmentAuditOutboxEvent"("deliveryState", "deliveredAt");
