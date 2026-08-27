-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "MicroLearning_courseId_idx" ON "public"."MicroLearning"("courseId");
