-- This migration intentionally remains non-transactional: PostgreSQL forbids
-- concurrent index creation inside a transaction. The nullable column is
-- backward compatible with the previous application version, while the
-- concurrent unique index avoids blocking assessment response writes during
-- the production rollout.
-- AlterTable
ALTER TABLE "LiveQuizResponse" ADD COLUMN     "submissionId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX CONCURRENTLY "LiveQuizResponse_submissionId_key" ON "LiveQuizResponse"("submissionId");

-- CreateIndex
CREATE INDEX CONCURRENTLY "AuditOutbox_quiz_correlation_event_idx" ON "AssessmentAuditOutboxEvent"("liveQuizId", "correlationId", "eventType");
