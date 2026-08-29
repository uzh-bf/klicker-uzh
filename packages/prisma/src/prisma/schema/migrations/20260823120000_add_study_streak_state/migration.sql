-- AlterTable
ALTER TABLE "Participation" ADD COLUMN     "studyStreakCurrent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studyStreakFreezeBalance" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "studyStreakLastProcessedDate" DATE,
ADD COLUMN     "studyStreakLastQualifiedDate" DATE,
ADD COLUMN     "studyStreakLongest" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studyStreakQualifiedDaysSinceFreeze" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studyStreakTrackingStartedAt" TIMESTAMP(3);

-- CreateIndex
-- Prisma does not generate CONCURRENTLY; this avoids blocking response writes
-- while the index is built on an existing production table.
CREATE INDEX CONCURRENTLY "QuestionResponse_participationId_lastAnsweredAt_idx" ON "QuestionResponse"("participationId", "lastAnsweredAt");

-- CreateIndex
CREATE INDEX CONCURRENTLY "QuestionResponseDetail_participationId_createdAt_idx" ON "QuestionResponseDetail"("participationId", "createdAt");
