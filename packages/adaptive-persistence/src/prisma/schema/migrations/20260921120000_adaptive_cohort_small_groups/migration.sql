-- Adaptive evaluation reports all completed participants, including small groups.
ALTER TABLE "AdaptivePracticeQuizCohortSnapshot"
  DROP CONSTRAINT "apqcs_release_size_check",
  ADD CONSTRAINT "apqcs_release_size_check" CHECK ("releaseSize" >= 1);
