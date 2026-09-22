-- AlterTable
ALTER TABLE "KB" ADD COLUMN     "domainPolicyId" TEXT,
ADD COLUMN     "domainPolicyLanguage" TEXT,
ADD COLUMN     "domainPolicyVersion" INTEGER;

-- Carry the subject area and language forward from the graph builds that already
-- ran, so a knowledge base keeps describing itself the way its published graph
-- was actually built. Written by hand because a schema diff cannot express it.
--
-- A published build is the authoritative answer: it is the build FalkorDB serves.
UPDATE "KB" AS kb
SET "domainPolicyId" = build."domainPolicyId",
    "domainPolicyVersion" = build."domainPolicyVersion",
    "domainPolicyLanguage" = build."domainPolicyLanguage"
FROM "KBGraphBuild" AS build
WHERE build."id" = kb."publishedGraphBuildId"
  AND build."domainPolicyId" IS NOT NULL
  AND build."domainPolicyVersion" IS NOT NULL
  AND build."domainPolicyLanguage" IS NOT NULL;

-- Without a published build, adopt the builds' own choice only when every build
-- that recorded one agrees. Disagreement and absence both stay null, because
-- guessing a subject would silently change how the next build runs.
UPDATE "KB" AS kb
SET "domainPolicyId" = agreed."domainPolicyId",
    "domainPolicyVersion" = agreed."domainPolicyVersion",
    "domainPolicyLanguage" = agreed."domainPolicyLanguage"
FROM (
  SELECT "kbId",
         MIN("domainPolicyId") AS "domainPolicyId",
         MIN("domainPolicyVersion") AS "domainPolicyVersion",
         MIN("domainPolicyLanguage") AS "domainPolicyLanguage"
  FROM "KBGraphBuild"
  WHERE "domainPolicyId" IS NOT NULL
    AND "domainPolicyVersion" IS NOT NULL
    AND "domainPolicyLanguage" IS NOT NULL
  GROUP BY "kbId"
  HAVING COUNT(DISTINCT ("domainPolicyId", "domainPolicyVersion", "domainPolicyLanguage")) = 1
) AS agreed
WHERE agreed."kbId" = kb."id"
  AND kb."domainPolicyId" IS NULL;
