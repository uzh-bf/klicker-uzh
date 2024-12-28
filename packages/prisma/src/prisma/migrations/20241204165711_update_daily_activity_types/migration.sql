/*
  Warnings:

  - You are about to drop the column `participantCount` on the `AggregatedCourseAnalytics` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[courseId]` on the table `AggregatedCourseAnalytics` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `courseParticipantCount` to the `AggregatedCourseAnalytics` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AggregatedCourseAnalytics" DROP COLUMN "participantCount",
ADD COLUMN     "courseParticipantCount" INTEGER NOT NULL,
ALTER COLUMN "activityMonday" SET DATA TYPE REAL,
ALTER COLUMN "activityTuesday" SET DATA TYPE REAL,
ALTER COLUMN "activityWednesday" SET DATA TYPE REAL,
ALTER COLUMN "activityThursday" SET DATA TYPE REAL,
ALTER COLUMN "activityFriday" SET DATA TYPE REAL,
ALTER COLUMN "activitySaturday" SET DATA TYPE REAL,
ALTER COLUMN "activitySunday" SET DATA TYPE REAL;

-- CreateIndex
CREATE UNIQUE INDEX "AggregatedCourseAnalytics_courseId_key" ON "AggregatedCourseAnalytics"("courseId");
