-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "ChatMessage_threadId_createdAt_idx" ON "public"."ChatMessage"("threadId", "createdAt");
