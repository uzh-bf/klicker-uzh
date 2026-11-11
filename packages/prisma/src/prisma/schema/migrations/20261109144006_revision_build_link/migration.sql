-- AlterTable
ALTER TABLE "ElementGenerationBuild" ADD COLUMN     "revisionUsedGraph" BOOLEAN,
ADD COLUMN     "slotSpecificationsRequested" BOOLEAN;

-- AlterTable
ALTER TABLE "GeneratedElementDraft" ADD COLUMN     "revisionBuildId" UUID;

-- CreateIndex
CREATE INDEX "GeneratedElementDraft_revisionBuildId_idx" ON "GeneratedElementDraft"("revisionBuildId");

-- AddForeignKey
ALTER TABLE "GeneratedElementDraft" ADD CONSTRAINT "GeneratedElementDraft_revisionBuildId_fkey" FOREIGN KEY ("revisionBuildId") REFERENCES "ElementGenerationBuild"("id") ON DELETE SET NULL ON UPDATE CASCADE;
