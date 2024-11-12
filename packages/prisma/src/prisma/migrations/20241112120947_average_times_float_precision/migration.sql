-- AlterTable
ALTER TABLE "InstanceStatistics" ALTER COLUMN "averageTimeSpent" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "QuestionResponse" ALTER COLUMN "averageTimeSpent" SET DEFAULT 0,
ALTER COLUMN "averageTimeSpent" SET DATA TYPE DOUBLE PRECISION;
