UPDATE "ParticipantAchievementInstance"
SET "receiptAcknowledgedAt" = CURRENT_TIMESTAMP
WHERE "receiptAcknowledgedAt" IS NULL;
