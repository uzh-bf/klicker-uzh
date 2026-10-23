-- Adaptive retakes (IRT_V1, Catalyst routing SEQUENTIAL_ROOTS_V7): a retake
-- starts questioning at the learner's previous result when it is recent
-- enough, and prefers questions the learner has not answered before.
-- Additive: new configurations default to on, existing publications keep the
-- previous behaviour (off) until the quiz is published again.

-- AlterTable
ALTER TABLE "PracticeQuizAdaptiveConfig" ADD COLUMN     "retakePreferNewQuestions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "retakeStartFromPreviousResult" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "retakeStartMaxAgeDays" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "PracticeQuizAdaptivePublication" ADD COLUMN     "retakePreferNewQuestions" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retakeStartFromPreviousResult" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "retakeStartMaxAgeDays" INTEGER NOT NULL DEFAULT 30;

-- AlterTable
ALTER TABLE "AdaptivePracticeQuizAttempt" ADD COLUMN     "retakeContext" JSONB;

-- AddCheckConstraint
ALTER TABLE "PracticeQuizAdaptiveConfig" ADD CONSTRAINT pqac_retake_start_max_age_days_check CHECK ((("retakeStartMaxAgeDays" >= 1) AND ("retakeStartMaxAgeDays" <= 365)));
ALTER TABLE "PracticeQuizAdaptivePublication" ADD CONSTRAINT pqap_retake_start_max_age_days_check CHECK ((("retakeStartMaxAgeDays" >= 1) AND ("retakeStartMaxAgeDays" <= 365)));
