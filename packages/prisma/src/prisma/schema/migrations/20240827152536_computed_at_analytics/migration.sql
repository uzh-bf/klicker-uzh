/*
  Warnings:

  - Added the required column `updatedAt` to the `AggregatedAnalytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `AggregatedCompetencyAnalytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `AggregatedCourseAnalytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `CompetencyAnalytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ParticipantAnalytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `ParticipantCourseAnalytics` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AggregatedAnalytics" ADD COLUMN     "computedAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "AggregatedCompetencyAnalytics" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "AggregatedCourseAnalytics" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "CompetencyAnalytics" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ParticipantAnalytics" ADD COLUMN     "computedAt" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "ParticipantCourseAnalytics" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
