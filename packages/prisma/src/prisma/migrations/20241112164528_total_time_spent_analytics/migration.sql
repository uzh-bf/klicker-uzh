/*
  Warnings:

  - Added the required column `totalTimeSpent` to the `AggregatedAnalytics` table without a default value. This is not possible if the table is not empty.
  - Added the required column `totalTimeSpent` to the `ParticipantAnalytics` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AggregatedAnalytics" ADD COLUMN     "totalTimeSpent" REAL NOT NULL;

-- AlterTable
ALTER TABLE "ParticipantAnalytics" ADD COLUMN     "totalTimeSpent" REAL NOT NULL;
