-- AlterTable
ALTER TABLE "QuestionResponse" ADD COLUMN     "averageTimeSpent" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "QuestionResponseDetail" ADD COLUMN     "timeSpent" INTEGER NOT NULL DEFAULT 0;
