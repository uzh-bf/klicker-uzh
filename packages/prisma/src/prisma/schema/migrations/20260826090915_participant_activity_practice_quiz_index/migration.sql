-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "ParticipantActivityPerformance_practiceQuizId_participantId_idx" ON "public"."ParticipantActivityPerformance"("practiceQuizId", "participantId");
