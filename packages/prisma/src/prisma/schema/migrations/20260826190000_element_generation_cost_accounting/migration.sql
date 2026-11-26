-- Account for every external element-generation dispatch in the same semester
-- quota used by graph builds. A dispatch attempt is the idempotency boundary.
CREATE TYPE "KBGraphQuotaSpendClass" AS ENUM (
  'GRAPH_BUILD',
  'QUESTION_GENERATION',
  'FLASHCARD_GENERATION',
  'FLASHCARD_RETRY'
);

ALTER TABLE "KBGraphBuild"
ADD COLUMN "spendClass" "KBGraphQuotaSpendClass" NOT NULL DEFAULT 'GRAPH_BUILD';

ALTER TABLE "ElementGenerationBuild"
ADD COLUMN "costAccountingVersion" INTEGER;

CREATE TABLE "ElementGenerationSpend" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "buildId" UUID NOT NULL,
  "quotaId" UUID NOT NULL,
  "dispatchAttemptId" UUID NOT NULL,
  "spendClass" "KBGraphQuotaSpendClass" NOT NULL,
  "semesterKey" TEXT NOT NULL,
  "estimatedCostMinorUnits" INTEGER NOT NULL,
  "actualCostMinorUnits" INTEGER,
  "costCurrency" TEXT NOT NULL,
  "costPricingVersion" TEXT NOT NULL,
  "costStatus" "KBGraphCostStatus" NOT NULL DEFAULT 'RESERVED',
  "dispatchClaimedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ElementGenerationSpend_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ElementGenerationSpend_estimatedCostMinorUnits_check"
    CHECK ("estimatedCostMinorUnits" > 0),
  CONSTRAINT "ElementGenerationSpend_actualCostMinorUnits_check"
    CHECK ("actualCostMinorUnits" IS NULL OR "actualCostMinorUnits" >= 0)
);

CREATE UNIQUE INDEX "ElementGenerationSpend_dispatchAttemptId_key"
ON "ElementGenerationSpend"("dispatchAttemptId");
CREATE INDEX "ElementGenerationSpend_buildId_createdAt_idx"
ON "ElementGenerationSpend"("buildId", "createdAt");
CREATE INDEX "ElementGenerationSpend_quotaId_idx"
ON "ElementGenerationSpend"("quotaId");

ALTER TABLE "ElementGenerationSpend"
ADD CONSTRAINT "ElementGenerationSpend_buildId_fkey"
FOREIGN KEY ("buildId") REFERENCES "ElementGenerationBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "ElementGenerationSpend_quotaId_fkey"
FOREIGN KEY ("quotaId") REFERENCES "KBGraphQuota"("id") ON DELETE CASCADE ON UPDATE CASCADE;
