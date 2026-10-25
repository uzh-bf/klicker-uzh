-- Extend the canonical graph-build ledger with the immutable bundle used by
-- generated Klicker-element workflows. The build id remains the graph version.
ALTER TABLE "KBGraphBuild"
ADD COLUMN "graphBundleContainerName" TEXT,
ADD COLUMN "graphBundleBlobPrefix" TEXT,
ADD COLUMN "graphBundleStorageName" TEXT,
ADD COLUMN "graphBundleSha256" TEXT,
ADD COLUMN "graphSha256" TEXT,
ADD COLUMN "graphManifestSchemaVersion" INTEGER,
ADD COLUMN "graphManifestArtifact" JSONB,
ADD COLUMN "generationArtifactsPurgedAt" TIMESTAMP(3);

-- One generation lifecycle serves all generated Klicker element types.
CREATE TYPE "ElementGenerationBuildStatus" AS ENUM (
    'PREPARING_INPUT',
    'QUEUED',
    'RUNNING',
    'DESIGNING',
    'WAITING_FOR_DESIGN_REVIEW',
    'GENERATING_ITEMS',
    'WAITING_FOR_PLAN_REVIEW',
    'FINALIZING',
    'AWAITING_INCOMPLETE_PUBLICATION',
    'PUBLISHING_INCOMPLETE',
    'COMPLETED',
    'INCOMPLETE',
    'REJECTED',
    'FAILED'
);

CREATE TYPE "ElementGenerationReviewGate" AS ENUM ('DESIGN', 'PLAN');
CREATE TYPE "ElementGenerationReviewDecision" AS ENUM ('APPROVE', 'REJECT');
CREATE TYPE "GeneratedElementDecision" AS ENUM ('OPEN', 'ACCEPTED', 'REJECTED');

CREATE TABLE "ElementGenerationBuild" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "sourceGraphBuildId" UUID NOT NULL,
    "elementType" "ElementType" NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "configurationHash" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "requestedElementCount" INTEGER NOT NULL,
    "generatedElementCount" INTEGER NOT NULL DEFAULT 0,
    "unresolvedElementCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ElementGenerationBuildStatus" NOT NULL DEFAULT 'PREPARING_INPUT',
    "stage" TEXT NOT NULL DEFAULT 'preparing_input',
    "providerEventId" TEXT,
    "providerWorkflowRunId" TEXT,
    "providerDispatchAttemptId" UUID NOT NULL DEFAULT gen_random_uuid(),
    "providerPublicationEventId" TEXT,
    "providerPublicationWorkflowRunId" TEXT,
    "providerPublicationDispatchAttemptId" UUID,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "inputArtifactContainer" TEXT,
    "inputArtifactPrefix" TEXT,
    "outputArtifactContainer" TEXT,
    "outputArtifactPrefix" TEXT,
    "blueprintArtifact" JSONB,
    "designArtifact" JSONB,
    "planArtifact" JSONB,
    "resultManifestArtifact" JSONB,
    "startManifestArtifact" JSONB,
    "finalBankArtifact" JSONB,
    "provenanceIndexArtifact" JSONB,
    "checkpointArtifact" JSONB,
    "designSummary" JSONB,
    "planSummary" JSONB,
    "lastSynchronizedAt" TIMESTAMP(3),
    "syncLeaseOwner" TEXT,
    "syncLeaseUntil" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "errorRetryable" BOOLEAN,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "incompletePublishedById" UUID,
    "incompletePublishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementGenerationBuild_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ElementGenerationBuild_supported_type_check"
        CHECK ("elementType" IN ('SC', 'MC', 'KPRIM', 'FLASHCARD')),
    CONSTRAINT "ElementGenerationBuild_requested_count_check"
        CHECK ("requestedElementCount" > 0),
    CONSTRAINT "ElementGenerationBuild_result_counts_check"
        CHECK (
            "generatedElementCount" >= 0
            AND "unresolvedElementCount" >= 0
            AND "warningCount" >= 0
        )
);

CREATE TABLE "ElementGenerationReview" (
    "id" UUID NOT NULL,
    "buildId" UUID NOT NULL,
    "gate" "ElementGenerationReviewGate" NOT NULL,
    "decision" "ElementGenerationReviewDecision" NOT NULL,
    "reviewerId" UUID NOT NULL,
    "warningsAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "artifact" JSONB NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElementGenerationReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GeneratedElementDraft" (
    "id" UUID NOT NULL,
    "buildId" UUID NOT NULL,
    "sourceElementId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "duplicationIndex" INTEGER NOT NULL DEFAULT 0,
    "elementType" "ElementType" NOT NULL,
    "parentDraftId" UUID,
    "original" JSONB NOT NULL,
    "current" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "decision" "GeneratedElementDecision" NOT NULL DEFAULT 'OPEN',
    "bloomLevel" TEXT,
    "targetDifficulty" INTEGER,
    "predictedDifficulty" DOUBLE PRECISION,
    "qualityFlags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "citations" JSONB NOT NULL,
    "provenance" JSONB,
    "savedElementId" INTEGER,
    "savedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedElementDraft_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "GeneratedElementDraft_supported_type_check"
        CHECK ("elementType" IN ('SC', 'MC', 'KPRIM', 'FLASHCARD')),
    CONSTRAINT "GeneratedElementDraft_order_check" CHECK ("order" >= 0),
    CONSTRAINT "GeneratedElementDraft_duplication_index_check" CHECK ("duplicationIndex" >= 0),
    CONSTRAINT "GeneratedElementDraft_difficulty_check"
        CHECK (
            ("elementType" = 'FLASHCARD' AND "targetDifficulty" IS NULL)
            OR (
                "elementType" IN ('SC', 'MC', 'KPRIM')
                AND "targetDifficulty" BETWEEN 1 AND 5
            )
        )
);

-- Difficulty is meaningful only for reviewed generated assessment questions.
ALTER TABLE "Element"
ADD COLUMN "difficultyLevel" INTEGER,
ADD CONSTRAINT "Element_generated_difficulty_check"
    CHECK (
        "difficultyLevel" IS NULL
        OR (
            "type" IN ('SC', 'MC', 'KPRIM')
            AND "difficultyLevel" BETWEEN 1 AND 5
        )
    );

CREATE UNIQUE INDEX "ElementGenerationBuild_ownerId_idempotencyKey_key"
ON "ElementGenerationBuild"("ownerId", "idempotencyKey");
CREATE INDEX "ElementGenerationBuild_ownerId_createdAt_idx"
ON "ElementGenerationBuild"("ownerId", "createdAt");
CREATE INDEX "ElementGenerationBuild_sourceGraphBuildId_status_idx"
ON "ElementGenerationBuild"("sourceGraphBuildId", "status");
CREATE INDEX "ElementGenerationBuild_status_syncLeaseUntil_idx"
ON "ElementGenerationBuild"("status", "syncLeaseUntil");

CREATE UNIQUE INDEX "ElementGenerationReview_buildId_gate_key"
ON "ElementGenerationReview"("buildId", "gate");
CREATE INDEX "ElementGenerationReview_reviewerId_reviewedAt_idx"
ON "ElementGenerationReview"("reviewerId", "reviewedAt");

CREATE UNIQUE INDEX "GeneratedElementDraft_savedElementId_key"
ON "GeneratedElementDraft"("savedElementId");
CREATE UNIQUE INDEX "GeneratedElementDraft_buildId_sourceElementId_duplication_key"
ON "GeneratedElementDraft"("buildId", "sourceElementId", "duplicationIndex");
CREATE INDEX "GeneratedElementDraft_buildId_order_idx"
ON "GeneratedElementDraft"("buildId", "order");
CREATE INDEX "GeneratedElementDraft_buildId_decision_savedElementId_idx"
ON "GeneratedElementDraft"("buildId", "decision", "savedElementId");

ALTER TABLE "ElementGenerationBuild"
ADD CONSTRAINT "ElementGenerationBuild_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "ElementGenerationBuild_sourceGraphBuildId_fkey"
FOREIGN KEY ("sourceGraphBuildId") REFERENCES "KBGraphBuild"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
ADD CONSTRAINT "ElementGenerationBuild_incompletePublishedById_fkey"
FOREIGN KEY ("incompletePublishedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ElementGenerationReview"
ADD CONSTRAINT "ElementGenerationReview_buildId_fkey"
FOREIGN KEY ("buildId") REFERENCES "ElementGenerationBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "ElementGenerationReview_reviewerId_fkey"
FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GeneratedElementDraft"
ADD CONSTRAINT "GeneratedElementDraft_buildId_fkey"
FOREIGN KEY ("buildId") REFERENCES "ElementGenerationBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "GeneratedElementDraft_parentDraftId_fkey"
FOREIGN KEY ("parentDraftId") REFERENCES "GeneratedElementDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "GeneratedElementDraft_savedElementId_fkey"
FOREIGN KEY ("savedElementId") REFERENCES "Element"("id") ON DELETE SET NULL ON UPDATE CASCADE;
