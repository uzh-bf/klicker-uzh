/*
  Warnings:

  - The primary key for the `TemporaryLeaderboardEntry` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - A unique constraint covering the columns `[id,quizId]` on the table `TemporaryLeaderboardEntry` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."TemporaryLeaderboardEntry" DROP CONSTRAINT "TemporaryLeaderboardEntry_pkey";

-- CreateIndex
CREATE INDEX "TemporaryLeaderboardEntry_id_idx" ON "public"."TemporaryLeaderboardEntry"("id");

-- CreateIndex
CREATE INDEX "TemporaryLeaderboardEntry_quizId_idx" ON "public"."TemporaryLeaderboardEntry"("quizId");

-- CreateIndex
CREATE UNIQUE INDEX "TemporaryLeaderboardEntry_id_quizId_key" ON "public"."TemporaryLeaderboardEntry"("id", "quizId");
