-- Prisma does not generate CONCURRENTLY; this avoids blocking response writes
-- while the index is built on an existing production table.
-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "QuestionResponse_participationId_idx" ON "QuestionResponse"("participationId");
