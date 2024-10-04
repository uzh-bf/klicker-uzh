/*
  Warnings:

  - You are about to drop the column `meanFirstCorrectCount` on the `ParticipantAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `meanLastCorrectCount` on the `ParticipantAnalytics` table. All the data in the column will be lost.
  - You are about to drop the column `collectedAchievements` on the `ParticipantAnalytics` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "ParticipantAnalytics" DROP COLUMN "meanFirstCorrectCount",
DROP COLUMN "meanLastCorrectCount",
DROP COLUMN "collectedAchievements",
ADD COLUMN     "firstCorrectCount" REAL,
ADD COLUMN     "firstWrongCount" REAL,
ADD COLUMN     "lastCorrectCount" REAL,
ADD COLUMN     "lastWrongCount" REAL;
