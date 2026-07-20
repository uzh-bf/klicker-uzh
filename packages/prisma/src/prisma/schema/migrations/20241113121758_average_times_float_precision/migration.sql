-- AlterTable
ALTER TABLE "InstanceStatistics" ALTER COLUMN "averageTimeSpent" SET DATA TYPE REAL;

-- AlterTable
ALTER TABLE "QuestionResponse" ALTER COLUMN "averageTimeSpent" DROP DEFAULT,
ALTER COLUMN "averageTimeSpent" SET DATA TYPE REAL;

-- AlterTable
ALTER TABLE "QuestionResponseDetail" ALTER COLUMN "timeSpent" DROP DEFAULT,
ALTER COLUMN "timeSpent" SET DATA TYPE REAL;
