-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "ParticipantAnalytics_courseId_type_timestamp_idx" ON "public"."ParticipantAnalytics"("courseId", "type", "timestamp");
