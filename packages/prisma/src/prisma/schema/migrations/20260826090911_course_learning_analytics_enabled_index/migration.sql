-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "Course_isLearningAnalyticsEnabled_id_idx" ON "public"."Course"("isLearningAnalyticsEnabled", "id");
