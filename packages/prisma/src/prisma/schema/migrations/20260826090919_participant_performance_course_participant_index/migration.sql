-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "ParticipantPerformance_courseId_participantId_idx" ON "public"."ParticipantPerformance"("courseId", "participantId");
