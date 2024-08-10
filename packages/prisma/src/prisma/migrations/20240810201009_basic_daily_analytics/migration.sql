/*
  Warnings:

  - Made the column `color` on table `Course` required. This step will fail if there are existing NULL values in that column.
  - Made the column `order` on table `SessionBlock` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "color" SET NOT NULL;

-- AlterTable
ALTER TABLE "SessionBlock" ALTER COLUMN "order" SET NOT NULL;

-- CreateTable
CREATE TABLE "AnalyticsDaily" (
    "id" SERIAL NOT NULL,
    "timestamp" DATE NOT NULL,
    "responseCount" INTEGER NOT NULL,
    "totalScore" DOUBLE PRECISION NOT NULL,
    "totalPoints" DOUBLE PRECISION NOT NULL,
    "totalXp" DOUBLE PRECISION NOT NULL,
    "collectedAchievements" TEXT[],
    "participantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,

    CONSTRAINT "AnalyticsDaily_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AnalyticsDaily" ADD CONSTRAINT "AnalyticsDaily_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnalyticsDaily" ADD CONSTRAINT "AnalyticsDaily_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
