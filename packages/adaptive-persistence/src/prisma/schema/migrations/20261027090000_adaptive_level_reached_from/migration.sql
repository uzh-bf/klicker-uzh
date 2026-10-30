-- IRT_V1 "level reached from": a level is reported once the estimate reaches
-- this share of its band (inner level boundaries move up by it). Existing
-- configurations keep 0, the previous bands; new ones get 0.7 from the preset
-- defaults. Publications freeze it in their evidence snapshot.

-- AlterTable
ALTER TABLE "PracticeQuizAdaptiveConfig" ADD COLUMN     "levelReachedFrom" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AddCheckConstraint
ALTER TABLE "PracticeQuizAdaptiveConfig" ADD CONSTRAINT pqac_level_reached_from_check CHECK ((("levelReachedFrom" >= 0) AND ("levelReachedFrom" <= 0.95)));
