-- Add check constraints to enforce minimum values on live quiz scoring parameters
ALTER TABLE "public"."LiveQuiz"
  ADD CONSTRAINT "LiveQuiz_pointsMultiplier_min_check" CHECK ("pointsMultiplier" >= 1),
  ADD CONSTRAINT "LiveQuiz_defaultPoints_min_check" CHECK ("defaultPoints" >= 0),
  ADD CONSTRAINT "LiveQuiz_defaultCorrectPoints_min_check" CHECK ("defaultCorrectPoints" >= 0),
  ADD CONSTRAINT "LiveQuiz_maxBonusPoints_min_check" CHECK ("maxBonusPoints" >= 0),
  ADD CONSTRAINT "LiveQuiz_timeToZeroBonus_min_check" CHECK ("timeToZeroBonus" >= 1);
