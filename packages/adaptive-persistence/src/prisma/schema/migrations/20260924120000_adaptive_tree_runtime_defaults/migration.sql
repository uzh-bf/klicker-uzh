ALTER TYPE "AdaptivePracticeQuizStopReason" ADD VALUE IF NOT EXISTS 'TIME_LIMIT';

ALTER TABLE "CompetenceTree"
  ADD COLUMN "defaultTotalQuestionCap" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "defaultTimeLimitSeconds" INTEGER;

ALTER TABLE "PracticeQuizAdaptiveConfig"
  ADD COLUMN "timeLimitSeconds" INTEGER;

ALTER TABLE "PracticeQuizAdaptivePublication"
  ADD COLUMN "timeLimitSeconds" INTEGER;

ALTER TABLE "CompetenceTree"
  ADD CONSTRAINT "ct_default_total_question_cap_check"
  CHECK ("defaultTotalQuestionCap" BETWEEN 2 AND 1000);

ALTER TABLE "CompetenceTree"
  ADD CONSTRAINT "ct_default_time_limit_seconds_check"
  CHECK ("defaultTimeLimitSeconds" IS NULL OR "defaultTimeLimitSeconds" > 0);

ALTER TABLE "PracticeQuizAdaptiveConfig"
  ADD CONSTRAINT "pqac_time_limit_seconds_check"
  CHECK ("timeLimitSeconds" IS NULL OR "timeLimitSeconds" > 0);

ALTER TABLE "PracticeQuizAdaptivePublication"
  ADD CONSTRAINT "pqap_time_limit_seconds_check"
  CHECK ("timeLimitSeconds" IS NULL OR "timeLimitSeconds" > 0);
