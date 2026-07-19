-- Keep this migration to one statement. Prisma 6.16.1 sends multi-statement
-- PostgreSQL migrations as one implicit transaction block, which is
-- incompatible with CREATE INDEX CONCURRENTLY.
CREATE UNIQUE INDEX CONCURRENTLY "Element_qrScanCode_key" ON "public"."Element"("qrScanCode");
