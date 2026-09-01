-- PostgreSQL rejects CREATE INDEX CONCURRENTLY inside a transaction block.
-- Keep this migration to one statement and do not wrap it in BEGIN/COMMIT.
CREATE UNIQUE INDEX CONCURRENTLY "Element_qrScanCode_key" ON "public"."Element"("qrScanCode");
