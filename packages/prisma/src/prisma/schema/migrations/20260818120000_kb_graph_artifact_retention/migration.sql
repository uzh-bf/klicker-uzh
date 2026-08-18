-- Track GraphML archive purging separately from FalkorDB graph retirement so the
-- archive can follow the knowledge-base lifecycle (retained while the KB exists,
-- purged after the deletion recovery grace) while `cleanedAt` keeps meaning
-- "serving graph retired".
ALTER TABLE "public"."KBGraphBuild"
ADD COLUMN "graphmlPurgedAt" TIMESTAMP(3);
