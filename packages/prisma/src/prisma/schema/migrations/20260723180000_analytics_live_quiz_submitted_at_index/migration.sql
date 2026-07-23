-- Script 14 ranks each participant's first and last response per instance by
-- submittedAt. Shared environments prebuild this through the checked-in
-- concurrent-index script, making this retry-safe statement a no-op.
CREATE INDEX IF NOT EXISTS "LiveQuizResponse_instanceId_participantId_submittedAt_idx"
ON "public"."LiveQuizResponse"("instanceId", "participantId", "submittedAt");
