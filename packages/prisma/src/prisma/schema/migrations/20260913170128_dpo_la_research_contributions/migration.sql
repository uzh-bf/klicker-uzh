-- CreateEnum
CREATE TYPE "AnalyticsResearchFamily" AS ENUM ('PARTICIPANT_ANALYTICS', 'AGGREGATED_ANALYTICS', 'PARTICIPANT_COURSE_ANALYTICS', 'AGGREGATED_COURSE_ANALYTICS', 'PARTICIPANT_PERFORMANCE', 'INSTANCE_PERFORMANCE', 'ACTIVITY_PERFORMANCE', 'PARTICIPANT_ACTIVITY_PERFORMANCE', 'ACTIVITY_PROGRESS');

-- CreateTable
CREATE TABLE "ParticipantAnalyticsResearchContribution" (
    "id" SERIAL NOT NULL,
    "family" "AnalyticsResearchFamily" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "scope" JSONB NOT NULL,
    "contributions" JSONB NOT NULL,
    "sourceWindowStart" TIMESTAMP(3),
    "sourceWindowEnd" TIMESTAMP(3),
    "generation" BIGINT NOT NULL,
    "disclosureVersion" TEXT NOT NULL,
    "choiceAt" TIMESTAMP(3) NOT NULL,
    "algorithmVersion" TEXT NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "participantAnalyticsId" INTEGER,
    "aggregatedAnalyticsId" INTEGER,
    "participantCourseAnalyticsId" INTEGER,
    "aggregatedCourseAnalyticsId" INTEGER,
    "participantPerformanceId" INTEGER,
    "instancePerformanceId" INTEGER,
    "activityPerformanceId" INTEGER,
    "participantActivityPerformanceId" INTEGER,
    "activityProgressId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantAnalyticsResearchContribution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParticipantAnalyticsResearchContribution_courseId_family_idx" ON "ParticipantAnalyticsResearchContribution"("courseId", "family");

-- CreateIndex
CREATE INDEX "ParticipantAnalyticsResearchContribution_participantId_fami_idx" ON "ParticipantAnalyticsResearchContribution"("participantId", "family");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantAnalyticsResearchContribution_family_participant_key" ON "ParticipantAnalyticsResearchContribution"("family", "participantId", "scopeKey");

-- AddForeignKey
ALTER TABLE "ParticipantAnalyticsResearchContribution" ADD CONSTRAINT "ParticipantAnalyticsResearchContribution_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAnalyticsResearchContribution" ADD CONSTRAINT "ParticipantAnalyticsResearchContribution_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAnalyticsResearchContribution" ADD CONSTRAINT "ParticipantAnalyticsResearchContribution_participantAnalyt_fkey" FOREIGN KEY ("participantAnalyticsId") REFERENCES "ParticipantAnalytics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAnalyticsResearchContribution" ADD CONSTRAINT "ParticipantAnalyticsResearchContribution_aggregatedAnalyti_fkey" FOREIGN KEY ("aggregatedAnalyticsId") REFERENCES "AggregatedAnalytics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAnalyticsResearchContribution" ADD CONSTRAINT "ParticipantAnalyticsResearchContribution_participantCourse_fkey" FOREIGN KEY ("participantCourseAnalyticsId") REFERENCES "ParticipantCourseAnalytics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAnalyticsResearchContribution" ADD CONSTRAINT "ParticipantAnalyticsResearchContribution_aggregatedCourseA_fkey" FOREIGN KEY ("aggregatedCourseAnalyticsId") REFERENCES "AggregatedCourseAnalytics"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAnalyticsResearchContribution" ADD CONSTRAINT "ParticipantAnalyticsResearchContribution_participantPerfor_fkey" FOREIGN KEY ("participantPerformanceId") REFERENCES "ParticipantPerformance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAnalyticsResearchContribution" ADD CONSTRAINT "ParticipantAnalyticsResearchContribution_instancePerforman_fkey" FOREIGN KEY ("instancePerformanceId") REFERENCES "InstancePerformance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAnalyticsResearchContribution" ADD CONSTRAINT "ParticipantAnalyticsResearchContribution_activityPerforman_fkey" FOREIGN KEY ("activityPerformanceId") REFERENCES "ActivityPerformance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAnalyticsResearchContribution" ADD CONSTRAINT "ParticipantAnalyticsResearchContribution_participantActivi_fkey" FOREIGN KEY ("participantActivityPerformanceId") REFERENCES "ParticipantActivityPerformance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAnalyticsResearchContribution" ADD CONSTRAINT "ParticipantAnalyticsResearchContribution_activityProgressI_fkey" FOREIGN KEY ("activityProgressId") REFERENCES "ActivityProgress"("id") ON DELETE SET NULL ON UPDATE CASCADE;
