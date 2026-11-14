ALTER TABLE "Achievement" ADD COLUMN     "isDiscoverable" BOOLEAN NOT NULL DEFAULT false;

-- Existing seeded achievements are earnable. Keep the column default false for
-- achievements added later without an explicit discoverability decision.
UPDATE "Achievement"
SET "isDiscoverable" = true
WHERE "id" IN (2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17);

-- AlterTable
ALTER TABLE "ParticipantAchievementInstance" ADD COLUMN     "receiptAcknowledgedAt" TIMESTAMP(3);
