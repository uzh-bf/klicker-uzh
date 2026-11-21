-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "ChatThread_participantId_idx" ON "ChatThread"("participantId");
