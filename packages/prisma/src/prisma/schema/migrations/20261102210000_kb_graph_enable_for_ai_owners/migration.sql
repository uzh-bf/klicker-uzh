-- Data-only migration: Prisma cannot express a data backfill, so this SQL is
-- hand-written. Knowledge bases created before scheduled graph preparation
-- followed the AI beta never received the per-knowledge-base graph opt-in,
-- and no lecturer could switch it on before then, so none of these values is
-- a deliberate opt-out. Opt in every live knowledge base whose owner has AI
-- features and the beta enabled; the nightly preparation still checks the
-- owner's full AI admission and quota before any build.
UPDATE "KB" AS kb
SET "knowledgeGraphEnabled" = true
FROM "User" AS owner
WHERE owner."id" = kb."ownerId"
  AND kb."deletedAt" IS NULL
  AND kb."knowledgeGraphEnabled" = false
  AND owner."aiFeaturesEnabled" = true
  AND owner."betaEnabled" = true;
