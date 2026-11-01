-- Trimmed from the generated diff: three unrelated statements reconciled
-- pre-existing schema/migration drift (ElementGenerationBuild default,
-- ElementGenerationSpend default, GeneratedElementDraft index rename).
-- They must not ride along with this additive snapshot migration.
ALTER TABLE "ElementGenerationBuild"
ADD COLUMN "librarySnapshotArtifact" JSONB;
