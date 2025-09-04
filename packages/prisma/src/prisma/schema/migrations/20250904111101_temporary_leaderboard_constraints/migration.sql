/*
  Warnings:

  - The primary key for the `TemporaryLeaderboardEntry` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- AlterTable
ALTER TABLE "public"."TemporaryLeaderboardEntry" DROP CONSTRAINT "TemporaryLeaderboardEntry_pkey",
ADD CONSTRAINT "TemporaryLeaderboardEntry_pkey" PRIMARY KEY ("id", "quizId");

-- CreateIndex
CREATE INDEX "TemporaryLeaderboardEntry_id_idx" ON "public"."TemporaryLeaderboardEntry"("id");

-- CreateIndex
CREATE INDEX "TemporaryLeaderboardEntry_quizId_idx" ON "public"."TemporaryLeaderboardEntry"("quizId");
