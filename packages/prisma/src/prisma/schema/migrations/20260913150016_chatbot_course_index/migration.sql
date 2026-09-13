-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "Chatbot_courseId_idx" ON "public"."Chatbot"("courseId");
