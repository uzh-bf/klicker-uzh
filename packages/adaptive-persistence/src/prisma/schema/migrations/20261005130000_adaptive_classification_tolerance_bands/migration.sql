-- Per-quiz IRT_V1 classification tolerance in level bands (Catalyst routing
-- SEQUENTIAL_ROOTS_V6): a node is classified when its interval lies within
-- the bands k−t … k+t around the band k containing θ. Additive and
-- backward-compatible: existing configurations receive 0, the exact rule, and
-- the host only sends the setting to the engine when it is above 0.

-- AlterTable
ALTER TABLE "PracticeQuizAdaptiveConfig" ADD COLUMN     "classificationToleranceBands" INTEGER NOT NULL DEFAULT 0;

-- AddCheckConstraint
ALTER TABLE "PracticeQuizAdaptiveConfig" ADD CONSTRAINT pqac_classification_tolerance_bands_check CHECK ((("classificationToleranceBands" >= 0) AND ("classificationToleranceBands" <= 5)));
