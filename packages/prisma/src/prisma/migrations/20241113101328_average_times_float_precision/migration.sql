-- AlterTable
ALTER TABLE "InstanceStatistics" ALTER COLUMN "averageTimeSpent" SET DATA TYPE REAL;

-- AlterTable
ALTER TABLE "QuestionResponse" ALTER COLUMN "averageTimeSpent" DROP DEFAULT,
ALTER COLUMN "averageTimeSpent" SET DATA TYPE REAL;

-- AlterTable
ALTER TABLE "QuestionResponseDetail" ALTER COLUMN "timeSpent" SET DEFAULT 0,
ALTER COLUMN "timeSpent" SET DATA TYPE REAL;
