/*
  Warnings:

  - You are about to drop the column `sessionBlockId` on the `LeaderboardEntry` table. All the data in the column will be lost.
  - The values [SESSION_BLOCK] on the enum `LeaderboardType` will be removed. If these variants are still used in the database, this will fail.

*/
-- DropForeignKey
ALTER TABLE "LeaderboardEntry" DROP CONSTRAINT "LeaderboardEntry_sessionBlockId_fkey";

-- DropIndex
DROP INDEX "LeaderboardEntry_type_participantId_sessionBlockId_key";

-- AlterTable
ALTER TABLE "LeaderboardEntry" DROP COLUMN "sessionBlockId";

-- AlterEnum
BEGIN;
CREATE TYPE "LeaderboardType_new" AS ENUM ('SESSION', 'COURSE');
ALTER TABLE "LeaderboardEntry" ALTER COLUMN "type" TYPE "LeaderboardType_new" USING ("type"::text::"LeaderboardType_new");
ALTER TYPE "LeaderboardType" RENAME TO "LeaderboardType_old";
ALTER TYPE "LeaderboardType_new" RENAME TO "LeaderboardType";
DROP TYPE "LeaderboardType_old";
COMMIT;