-- Persist only privacy-reviewed cohort aggregates at fixed release boundaries.
CREATE TABLE "AdaptivePracticeQuizCohortSnapshot" (
    "id" UUID NOT NULL,
    "configId" UUID NOT NULL,
    "practiceQuizId" UUID NOT NULL,
    "releaseSize" INTEGER NOT NULL,
    "releaseWatermark" TIMESTAMP(3) NOT NULL,
    "policyVersion" INTEGER NOT NULL DEFAULT 1,
    "attemptSelectionPolicy" "AdaptiveAttemptSelectionPolicy" NOT NULL,
    "aggregate" JSONB NOT NULL,
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptivePracticeQuizCohortSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "apqcs_release_size_check" CHECK (
      "releaseSize" >= 5 AND "releaseSize" % 5 = 0
    ),
    CONSTRAINT "apqcs_policy_version_check" CHECK ("policyVersion" > 0),
    CONSTRAINT "apqcs_aggregate_schema_check" CHECK (
      jsonb_typeof("aggregate") = 'object'
      AND "aggregate" ->> 'schemaVersion' = '1'
    )
);

CREATE INDEX "apqcs_config_valid_release_idx"
  ON "AdaptivePracticeQuizCohortSnapshot"("configId", "invalidatedAt", "releaseSize");

CREATE INDEX "apqcs_quiz_retention_idx"
  ON "AdaptivePracticeQuizCohortSnapshot"("practiceQuizId");

CREATE UNIQUE INDEX "apqcs_release_policy_key"
  ON "AdaptivePracticeQuizCohortSnapshot"(
    "configId",
    "releaseSize",
    "policyVersion",
    "attemptSelectionPolicy"
  );

CREATE INDEX "apqa_quiz_status_completed_idx"
  ON "AdaptivePracticeQuizAttempt"("practiceQuizId", "status", "completedAt", "id");

CREATE INDEX "apqa_quiz_participant_completed_idx"
  ON "AdaptivePracticeQuizAttempt"(
    "practiceQuizId",
    "participantId",
    "status",
    "completedAt",
    "id"
  );

CREATE INDEX "apqe_attempt_node_level_idx"
  ON "AdaptivePracticeQuizEstimate"("attemptId", "nodeKind", "nodeId", "levelId");

CREATE INDEX "apqr_config_pool_attempt_idx"
  ON "AdaptivePracticeQuizResponse"("configId", "poolItemId", "attemptId");

ALTER TABLE "AdaptivePracticeQuizCohortSnapshot"
  ADD CONSTRAINT "AdaptivePracticeQuizCohortSnapshot_configId_practiceQuizId_fkey"
  FOREIGN KEY ("configId", "practiceQuizId")
  REFERENCES "PracticeQuizAdaptiveConfig"("id", "practiceQuizId")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- Participant erasure cascades through attempts. Any aggregate that may contain
-- the erased participant's contribution is withheld until it is recomputed at
-- a fresh complete release boundary.
CREATE FUNCTION invalidate_adaptive_cohort_snapshots_on_attempt_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "AdaptivePracticeQuizCohortSnapshot"
  SET
    "invalidatedAt" = CURRENT_TIMESTAMP,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE "configId" IN (
    SELECT DISTINCT "configId"
    FROM deleted_adaptive_attempts
  );

  RETURN NULL;
END;
$$;

CREATE TRIGGER "apqa_invalidate_cohort_snapshots_after_delete"
AFTER DELETE ON "AdaptivePracticeQuizAttempt"
REFERENCING OLD TABLE AS deleted_adaptive_attempts
FOR EACH STATEMENT
EXECUTE FUNCTION invalidate_adaptive_cohort_snapshots_on_attempt_delete();
