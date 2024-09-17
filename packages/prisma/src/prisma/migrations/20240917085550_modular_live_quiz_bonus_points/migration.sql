-- AlterTable
ALTER TABLE "LiveQuiz" ADD COLUMN     "maxBonusPoints" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "timeToZeroBonus" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN     "maxBonusPoints" INTEGER NOT NULL DEFAULT 45,
ADD COLUMN     "timeToZeroBonus" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "QuestionInstance" ADD COLUMN     "maxBonusPoints" INTEGER,
ADD COLUMN     "timeToZeroBonus" INTEGER;
