-- Keep this migration to one statement so Prisma can run the concurrent build outside a transaction.
CREATE INDEX CONCURRENTLY "QuestionResponseDetail_createdAt_brin_idx" ON "public"."QuestionResponseDetail" USING BRIN ("createdAt");
