-- AlterEnum
ALTER TYPE "GeneratedElementDecision" ADD VALUE 'REVISION_REQUESTED';

-- AlterEnum
ALTER TYPE "KBGraphQuotaSpendClass" ADD VALUE 'ELEMENT_REVISION';

-- AlterTable
ALTER TABLE "ElementGenerationBuild" ADD COLUMN     "evidencePurgedAt" TIMESTAMP(3),
ADD COLUMN     "parentBuildId" UUID,
ADD COLUMN     "revisionDraftSnapshot" JSONB,
ADD COLUMN     "revisionNote" TEXT,
ADD COLUMN     "revisionOfDraftId" UUID;

-- AlterTable
ALTER TABLE "GeneratedElementDraft" ADD COLUMN     "revisionOfDraftId" UUID;

-- CreateIndex
CREATE INDEX "ElementGenerationBuild_parentBuildId_idx" ON "ElementGenerationBuild"("parentBuildId");

-- CreateIndex
CREATE INDEX "ElementGenerationBuild_revisionOfDraftId_idx" ON "ElementGenerationBuild"("revisionOfDraftId");

-- CreateIndex
CREATE INDEX "GeneratedElementDraft_revisionOfDraftId_idx" ON "GeneratedElementDraft"("revisionOfDraftId");

-- AddForeignKey
ALTER TABLE "ElementGenerationBuild" ADD CONSTRAINT "ElementGenerationBuild_parentBuildId_fkey" FOREIGN KEY ("parentBuildId") REFERENCES "ElementGenerationBuild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementGenerationBuild" ADD CONSTRAINT "ElementGenerationBuild_revisionOfDraftId_fkey" FOREIGN KEY ("revisionOfDraftId") REFERENCES "GeneratedElementDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedElementDraft" ADD CONSTRAINT "GeneratedElementDraft_revisionOfDraftId_fkey" FOREIGN KEY ("revisionOfDraftId") REFERENCES "GeneratedElementDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;
