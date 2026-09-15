-- The monitor's anti-join starts with accepted submission events and groups
-- them by quiz, lifecycle epoch, and correlation id. Prisma does not yet
-- represent partial indexes, so keep this migration-owned index alongside
-- the schema model's general-purpose indexes.
CREATE INDEX "AssessmentAuditOutboxEvent_submission_accepted_gap_idx"
ON "AssessmentAuditOutboxEvent"
  ("liveQuizId", "lifecycleEpoch", "correlationId", "recordedAt", "eventId")
WHERE "eventType" = 'SUBMISSION_SERVER_ACCEPTED';

CREATE INDEX "AssessmentAuditOutboxEvent_submission_terminal_lookup_idx"
ON "AssessmentAuditOutboxEvent"
  ("liveQuizId", "lifecycleEpoch", "correlationId", "eventType");
