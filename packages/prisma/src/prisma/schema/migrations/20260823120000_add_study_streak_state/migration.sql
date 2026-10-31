-- AlterTable
ALTER TABLE "Participation" ADD COLUMN     "studyStreakCurrent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studyStreakFreezeBalance" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "studyStreakLastProcessedDate" DATE,
ADD COLUMN     "studyStreakLastQualifiedDate" DATE,
ADD COLUMN     "studyStreakLongest" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studyStreakQualifiedDaysSinceFreeze" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studyStreakTrackingStartedAt" TIMESTAMP(3);
