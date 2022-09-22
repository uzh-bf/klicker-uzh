-- AlterTable
ALTER TABLE "LeaderboardEntry" ADD COLUMN     "sessionParticipationId" INTEGER;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_sessionParticipationId_fkey" FOREIGN KEY ("sessionParticipationId") REFERENCES "Participation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
