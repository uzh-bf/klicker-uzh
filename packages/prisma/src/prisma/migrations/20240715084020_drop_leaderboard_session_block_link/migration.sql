/*
  Warnings:

  - You are about to drop the column `sessionBlockId` on the `LeaderboardEntry` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "LeaderboardEntry" DROP CONSTRAINT "LeaderboardEntry_sessionBlockId_fkey";

-- DropIndex
DROP INDEX "LeaderboardEntry_type_participantId_sessionBlockId_key";

-- AlterTable
ALTER TABLE "LeaderboardEntry" DROP COLUMN "sessionBlockId";
