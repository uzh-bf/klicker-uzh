-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "QuestionResponse_courseId_createdAt_idx" ON "public"."QuestionResponse"("courseId", "createdAt");
