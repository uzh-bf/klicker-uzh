-- Lecturer attempt diagnostics (testing environments only). Additive and
-- backward-compatible: the new response columns are nullable and older
-- answers keep NULL until the diagnostics backfill replays them; the review
-- table is new.

-- AlterTable
ALTER TABLE "AdaptivePracticeQuizResponse" ADD COLUMN     "competenceThetaBefore" DOUBLE PRECISION,
ADD COLUMN     "competenceStandardErrorBefore" DOUBLE PRECISION,
ADD COLUMN     "competenceThetaAfter" DOUBLE PRECISION,
ADD COLUMN     "competenceStandardErrorAfter" DOUBLE PRECISION;

-- AddCheckConstraint
ALTER TABLE "AdaptivePracticeQuizResponse" ADD CONSTRAINT apqr_competence_estimate_check CHECK ((("competenceThetaBefore" IS NULL) OR (("competenceThetaBefore" >= ('-10'::integer)::double precision) AND ("competenceThetaBefore" <= (10)::double precision))) AND (("competenceThetaAfter" IS NULL) OR (("competenceThetaAfter" >= ('-10'::integer)::double precision) AND ("competenceThetaAfter" <= (10)::double precision))) AND (("competenceStandardErrorBefore" IS NULL) OR ("competenceStandardErrorBefore" > (0)::double precision)) AND (("competenceStandardErrorAfter" IS NULL) OR ("competenceStandardErrorAfter" > (0)::double precision)));

-- CreateEnum
CREATE TYPE "AdaptiveAttemptReviewVerdict" AS ENUM ('AS_EXPECTED', 'TOO_HIGH', 'TOO_LOW', 'UNSURE');

-- CreateTable
CREATE TABLE "AdaptivePracticeQuizAttemptReview" (
    "id" UUID NOT NULL,
    "attemptId" UUID NOT NULL,
    "reviewerId" UUID NOT NULL,
    "verdict" "AdaptiveAttemptReviewVerdict" NOT NULL,
    "expectedOverallLevelLabel" TEXT,
    "expectedCompetenceLevels" JSONB NOT NULL DEFAULT '[]',
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptivePracticeQuizAttemptReview_pkey" PRIMARY KEY ("id"),
    CONSTRAINT apqar_comment_length_check CHECK (("comment" IS NULL) OR (char_length("comment") <= 2000))
);

-- CreateIndex
CREATE UNIQUE INDEX "apqar_attempt_reviewer_key" ON "AdaptivePracticeQuizAttemptReview"("attemptId", "reviewerId");

-- CreateIndex
CREATE INDEX "apqar_reviewer_idx" ON "AdaptivePracticeQuizAttemptReview"("reviewerId");

-- AddForeignKey
ALTER TABLE "AdaptivePracticeQuizAttemptReview" ADD CONSTRAINT "AdaptivePracticeQuizAttemptReview_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AdaptivePracticeQuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdaptivePracticeQuizAttemptReview" ADD CONSTRAINT "AdaptivePracticeQuizAttemptReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
