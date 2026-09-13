-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "LiveQuizResponse_instanceId_participantId_submittedAt_idx" ON "public"."LiveQuizResponse"("instanceId", "participantId", "submittedAt");
