-- CreateEnum
CREATE TYPE "AnalyticsType" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'COURSE');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "areAnalyticsValid" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ParticipantAnalytics" (
    "id" SERIAL NOT NULL,
    "type" "AnalyticsType" NOT NULL,
    "timestamp" DATE NOT NULL,
    "trialsCount" INTEGER NOT NULL,
    "responseCount" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL,
    "totalXp" INTEGER NOT NULL,
    "meanCorrectCount" REAL NOT NULL,
    "meanPartialCorrectCount" REAL NOT NULL,
    "meanWrongCount" REAL NOT NULL,
    "meanFirstCorrectCount" REAL NOT NULL,
    "meanLastCorrectCount" REAL NOT NULL,
    "collectedAchievements" TEXT[],
    "participantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,

    CONSTRAINT "ParticipantAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggregatedAnalytics" (
    "id" SERIAL NOT NULL,
    "type" "AnalyticsType" NOT NULL,
    "timestamp" DATE NOT NULL,
    "responseCount" INTEGER NOT NULL,
    "participantCount" INTEGER NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL,
    "totalXp" INTEGER NOT NULL,
    "totalElementsAvailable" INTEGER NOT NULL,
    "courseId" UUID NOT NULL,

    CONSTRAINT "AggregatedAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetencyAnalytics" (
    "id" SERIAL NOT NULL,
    "unsolvedQuestionsCount" SMALLINT NOT NULL,
    "lastCorrectCount" SMALLINT NOT NULL,
    "lastPartialCorrectCount" SMALLINT NOT NULL,
    "lastWrongCount" SMALLINT NOT NULL,
    "competencyId" INTEGER NOT NULL,
    "participantAnalyticsId" INTEGER NOT NULL,

    CONSTRAINT "CompetencyAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggregatedCompetencyAnalytics" (
    "id" SERIAL NOT NULL,
    "meanUnsolvedQuestionsCount" SMALLINT NOT NULL,
    "meanLastCorrectCount" SMALLINT NOT NULL,
    "meanLastPartialCorrectCount" SMALLINT NOT NULL,
    "meanLastWrongCount" SMALLINT NOT NULL,
    "competencyId" INTEGER NOT NULL,
    "aggregatedAnalyticsId" INTEGER NOT NULL,

    CONSTRAINT "AggregatedCompetencyAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantCourseAnalytics" (
    "id" SERIAL NOT NULL,
    "activeWeeks" INTEGER NOT NULL,
    "activeDaysPerWeek" REAL NOT NULL,
    "meanElementsPerDay" REAL NOT NULL,
    "activityLevel" "ActivityLevel" NOT NULL,
    "courseId" UUID NOT NULL,
    "participantId" UUID NOT NULL,

    CONSTRAINT "ParticipantCourseAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggregatedCourseAnalytics" (
    "id" SERIAL NOT NULL,
    "participantCount" INTEGER NOT NULL,
    "activityMonday" INTEGER NOT NULL,
    "activityTuesday" INTEGER NOT NULL,
    "activityWednesday" INTEGER NOT NULL,
    "activityThursday" INTEGER NOT NULL,
    "activityFriday" INTEGER NOT NULL,
    "activitySaturday" INTEGER NOT NULL,
    "activitySunday" INTEGER NOT NULL,
    "courseId" UUID NOT NULL,

    CONSTRAINT "AggregatedCourseAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantAnalytics_type_courseId_participantId_timestamp_key" ON "ParticipantAnalytics"("type", "courseId", "participantId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "AggregatedAnalytics_type_courseId_timestamp_key" ON "AggregatedAnalytics"("type", "courseId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyAnalytics_competencyId_participantAnalyticsId_key" ON "CompetencyAnalytics"("competencyId", "participantAnalyticsId");

-- CreateIndex
CREATE UNIQUE INDEX "AggregatedCompetencyAnalytics_competencyId_aggregatedAnalyt_key" ON "AggregatedCompetencyAnalytics"("competencyId", "aggregatedAnalyticsId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantCourseAnalytics_courseId_participantId_key" ON "ParticipantCourseAnalytics"("courseId", "participantId");

-- AddForeignKey
ALTER TABLE "ParticipantAnalytics" ADD CONSTRAINT "ParticipantAnalytics_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAnalytics" ADD CONSTRAINT "ParticipantAnalytics_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregatedAnalytics" ADD CONSTRAINT "AggregatedAnalytics_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAnalytics" ADD CONSTRAINT "CompetencyAnalytics_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetencyAnalytics" ADD CONSTRAINT "CompetencyAnalytics_participantAnalyticsId_fkey" FOREIGN KEY ("participantAnalyticsId") REFERENCES "ParticipantAnalytics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregatedCompetencyAnalytics" ADD CONSTRAINT "AggregatedCompetencyAnalytics_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregatedCompetencyAnalytics" ADD CONSTRAINT "AggregatedCompetencyAnalytics_aggregatedAnalyticsId_fkey" FOREIGN KEY ("aggregatedAnalyticsId") REFERENCES "AggregatedAnalytics"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantCourseAnalytics" ADD CONSTRAINT "ParticipantCourseAnalytics_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantCourseAnalytics" ADD CONSTRAINT "ParticipantCourseAnalytics_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregatedCourseAnalytics" ADD CONSTRAINT "AggregatedCourseAnalytics_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
