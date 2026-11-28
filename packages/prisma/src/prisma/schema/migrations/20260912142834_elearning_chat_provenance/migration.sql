-- Trimmed from the generated diff: three unrelated statements reconciled
-- pre-existing schema/migration drift (ElementGenerationBuild default,
-- ElementGenerationSpend default, GeneratedElementDraft index rename).
-- They must not ride along with the additive chat provenance migration.
-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "learningContext" JSONB;

-- AlterTable
ALTER TABLE "ChatThread" ADD COLUMN     "origin" TEXT;
