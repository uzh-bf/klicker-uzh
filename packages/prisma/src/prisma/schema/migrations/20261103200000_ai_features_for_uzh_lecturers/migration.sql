-- Data-only migration: Prisma cannot express a data backfill, so this SQL is
-- hand-written. Knowledge bases and chatbots open to every UZH lecturer, so
-- switch on the AI approval for each lecturer account whose email, or one of
-- whose eduID affiliations, is on uzh.ch or a subdomain of it. USZ and other
-- Catalyst institutions are not included. The rule mirrors `isUzhAffiliated`
-- in packages/util/src/auth.ts, which sets the approval for new accounts.
-- The column defaults to false, so a deliberate administrator opt-out cannot
-- be told apart and is switched on as well. Question and flashcard generation
-- keep their own rollout flag and do not open with this approval.
-- Administrator accounts are lecturers too and are included.
UPDATE "User" AS u
SET "aiFeaturesEnabled" = true
WHERE u."role" IN ('USER', 'ADMIN')
  AND u."aiFeaturesEnabled" = false
  AND (
    lower(split_part(u."email", '@', 2)) = 'uzh.ch'
    OR lower(split_part(u."email", '@', 2)) LIKE '%.uzh.ch'
    OR EXISTS (
      SELECT 1
      FROM "Account" AS a
      WHERE a."userId" = u."id"
        AND a."type" = 'affiliation'
        AND (
          lower(split_part(a."providerAccountId", '@', 2)) = 'uzh.ch'
          OR lower(split_part(a."providerAccountId", '@', 2)) LIKE '%.uzh.ch'
        )
    )
  );
