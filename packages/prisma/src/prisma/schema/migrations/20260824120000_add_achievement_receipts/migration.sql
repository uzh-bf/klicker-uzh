ALTER TABLE "Achievement" ADD COLUMN     "isDiscoverable" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ParticipantAchievementInstance" ADD COLUMN     "receiptAcknowledgedAt" TIMESTAMP(3);
