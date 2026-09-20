-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "AggregatedAnalytics_courseId_type_timestamp_idx" ON "public"."AggregatedAnalytics"("courseId", "type", "timestamp");
