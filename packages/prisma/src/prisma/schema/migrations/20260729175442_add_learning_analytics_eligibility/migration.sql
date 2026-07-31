-- CreateEnum
CREATE TYPE "LearningAnalyticsParticipationStatus" AS ENUM ('UNDECIDED', 'INCLUDED', 'EXCLUDED');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "isLearningAnalyticsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Participation" ADD COLUMN     "learningAnalyticsChoiceAt" TIMESTAMP(3),
ADD COLUMN     "learningAnalyticsDisclosureVersion" TEXT,
ADD COLUMN     "learningAnalyticsIncludedFrom" TIMESTAMP(3),
ADD COLUMN     "learningAnalyticsStatus" "LearningAnalyticsParticipationStatus" NOT NULL DEFAULT 'UNDECIDED';

-- CreateTable
CREATE TABLE "LearningAnalyticsChoiceEvent" (
    "id" SERIAL NOT NULL,
    "status" "LearningAnalyticsParticipationStatus" NOT NULL,
    "includedFrom" TIMESTAMP(3),
    "disclosureVersion" TEXT NOT NULL,
    "participationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningAnalyticsChoiceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearningAnalyticsChoiceEvent_participationId_createdAt_idx" ON "LearningAnalyticsChoiceEvent"("participationId", "createdAt");

-- CreateIndex
CREATE INDEX "Participation_courseId_learningAnalyticsStatus_idx" ON "Participation"("courseId", "learningAnalyticsStatus");

-- AddForeignKey
ALTER TABLE "LearningAnalyticsChoiceEvent" ADD CONSTRAINT "LearningAnalyticsChoiceEvent_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
