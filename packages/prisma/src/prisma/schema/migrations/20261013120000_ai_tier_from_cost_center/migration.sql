-- Data-only migration: the advanced subscription tier now gates advanced chat
-- models, and setting a cost center grants that tier. Accounts that already
-- have a cost center receive the tier here, so their advanced models keep
-- working once admission checks it. Prisma cannot generate data updates, so
-- this SQL is hand-written. It matches only base accounts with a non-blank
-- cost center, so a re-run changes nothing.

UPDATE "User"
SET "aiSubscriptionTier" = 'ADVANCED'
WHERE "aiSubscriptionTier" = 'BASE'
  AND btrim(coalesce("aiChatbotCostCenter", '')) <> '';
