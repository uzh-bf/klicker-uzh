-- Configurable per-quiz minimum of enabled elements per enabled
-- subcompetence × level coverage cell (product presets only). Additive and
-- backward-compatible: existing configurations receive the previous fixed
-- minimum of 5, so readiness behavior is unchanged until an author lowers it.

-- AlterTable
ALTER TABLE "PracticeQuizAdaptiveConfig" ADD COLUMN     "minItemsPerCoverageCell" INTEGER NOT NULL DEFAULT 5;

-- AddCheckConstraint
ALTER TABLE "PracticeQuizAdaptiveConfig" ADD CONSTRAINT pqac_min_items_per_coverage_cell_check CHECK ((("minItemsPerCoverageCell" >= 1) AND ("minItemsPerCoverageCell" <= 5)));
