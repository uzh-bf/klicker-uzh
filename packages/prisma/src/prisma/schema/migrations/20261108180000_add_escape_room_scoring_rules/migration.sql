-- AlterTable
ALTER TABLE "EscapeRoomAttempt" ADD COLUMN     "stageOutcomes" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "EscapeRoomConfig" ADD COLUMN     "bonusSeconds" INTEGER,
ADD COLUMN     "hintPenalties" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "maxWrongAttempts" INTEGER,
ADD COLUMN     "revealPenalty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "skipPenalty" INTEGER,
ADD COLUMN     "wrongAnswerPenalty" INTEGER NOT NULL DEFAULT 0;

