-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "ParticipantActivityPerformance_microLearningId_participantI_idx" ON "public"."ParticipantActivityPerformance"("microLearningId", "participantId");
