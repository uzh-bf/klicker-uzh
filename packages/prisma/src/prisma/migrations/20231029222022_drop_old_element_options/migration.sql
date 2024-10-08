/*
  Warnings:

  - You are about to drop the column `displayMode` on the `Element` table. All the data in the column will be lost.
  - You are about to drop the column `hasAnswerFeedbacks` on the `Element` table. All the data in the column will be lost.
  - You are about to drop the column `hasSampleSolution` on the `Element` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Element" DROP COLUMN "displayMode",
DROP COLUMN "hasAnswerFeedbacks",
DROP COLUMN "hasSampleSolution";
