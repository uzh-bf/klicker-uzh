-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "QuestionResponseDetail_participationId_createdAt_idx" ON "QuestionResponseDetail"("participationId", "createdAt");
