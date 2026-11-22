-- Records which adaptive engine build started an attempt, so testers can
-- replay its behaviour. Additive; existing attempts keep null.

-- AlterTable
ALTER TABLE "AdaptivePracticeQuizAttempt" ADD COLUMN     "engineRevision" TEXT;
