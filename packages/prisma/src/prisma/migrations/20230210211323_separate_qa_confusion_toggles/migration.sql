-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "isConfusionFeedbackEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isLiveQAEnabled" BOOLEAN NOT NULL DEFAULT false;
