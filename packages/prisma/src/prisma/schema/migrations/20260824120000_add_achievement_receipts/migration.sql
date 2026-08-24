ALTER TABLE "Achievement" ADD COLUMN     "isDiscoverable" BOOLEAN NOT NULL DEFAULT false;

-- Existing seeded achievements are earnable. Keep the column default false for
-- achievements added later without an explicit discoverability decision.
UPDATE "Achievement"
SET "isDiscoverable" = true;

-- AlterTable
ALTER TABLE "ParticipantAchievementInstance" ADD COLUMN     "receiptAcknowledgedAt" TIMESTAMP(3);
