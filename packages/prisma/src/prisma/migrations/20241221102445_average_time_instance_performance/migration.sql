/*
  Warnings:

  - Added the required column `averageTimeSpent` to the `InstancePerformance` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InstancePerformance" ADD COLUMN     "averageTimeSpent" REAL NOT NULL;
