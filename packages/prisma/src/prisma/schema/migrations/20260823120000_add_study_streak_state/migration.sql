
-- AlterTable
ALTER TABLE "Participation" ADD COLUMN     "studyStreakCurrent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studyStreakFreezeBalance" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "studyStreakLastProcessedDate" DATE,
ADD COLUMN     "studyStreakLastQualifiedDate" DATE,
ADD COLUMN     "studyStreakLongest" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studyStreakQualifiedDaysSinceFreeze" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studyStreakTrackingStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "QuestionResponse_participationId_lastAnsweredAt_idx" ON "QuestionResponse"("participationId", "lastAnsweredAt");

-- CreateIndex
CREATE INDEX "QuestionResponseDetail_participationId_createdAt_idx" ON "QuestionResponseDetail"("participationId", "createdAt");

