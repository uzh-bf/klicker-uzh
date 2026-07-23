-- Script 14 resolves LiveQuiz through ElementInstance and orders responses by
-- submittedAt. Shared environments prebuild this through the checked-in
-- concurrent-index script, making this retry-safe statement a no-op.
CREATE INDEX IF NOT EXISTS "LiveQuizResponse_instanceId_submittedAt_idx"
ON "public"."LiveQuizResponse"("instanceId", "submittedAt");
