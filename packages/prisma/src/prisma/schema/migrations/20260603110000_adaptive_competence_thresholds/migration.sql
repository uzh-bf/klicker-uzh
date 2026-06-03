-- Add optional competence-level adaptive stopping rules.
ALTER TABLE "AdaptiveAssessmentCompetence"
  ADD COLUMN "questionThreshold" INTEGER,
  ADD COLUMN "standardErrorThreshold" DOUBLE PRECISION;
