-- CreateIndex
-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "ConfusionTimestep_liveQuizId_createdAt_idx" ON "ConfusionTimestep"("liveQuizId", "createdAt");
