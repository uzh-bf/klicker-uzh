-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "LiveQuizResponse_createdAt_brin_idx" ON "public"."LiveQuizResponse" USING BRIN ("createdAt");
