-- Data-only migration: the advanced subscription tier now gates advanced chat
-- models, and setting a cost center grants that tier. Accounts that already
-- have a cost center receive the tier here, so their advanced models keep
-- working once admission checks it. Prisma cannot generate data updates, so
-- this SQL is hand-written. It matches only base accounts with a non-blank
-- cost center, so a re-run changes nothing.

UPDATE "User"
SET "aiSubscriptionTier" = 'ADVANCED'
WHERE "aiSubscriptionTier" = 'BASE'
  AND btrim(
    coalesce("aiChatbotCostCenter", ''),
    U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
  ) <> '';
