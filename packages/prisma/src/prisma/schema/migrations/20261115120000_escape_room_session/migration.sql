-- CreateEnum
CREATE TYPE "EscapeRoomSessionPhase" AS ENUM ('LOBBY', 'RUNNING', 'PAUSED', 'ENDED');

-- AlterTable
ALTER TABLE "EscapeRoomConfig" ADD COLUMN     "sessionClock" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sessionEndedAt" TIMESTAMP(3),
ADD COLUMN     "sessionPausedAt" TIMESTAMP(3),
ADD COLUMN     "sessionPauses" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "sessionPhase" "EscapeRoomSessionPhase" NOT NULL DEFAULT 'LOBBY',
ADD COLUMN     "sessionStartedAt" TIMESTAMP(3);
