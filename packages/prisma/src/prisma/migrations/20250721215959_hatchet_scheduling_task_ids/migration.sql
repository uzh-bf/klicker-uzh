-- AlterTable
ALTER TABLE "GroupActivity" ADD COLUMN     "schedulingTaskId" TEXT;

-- AlterTable
ALTER TABLE "LiveQuiz" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "schedulingTaskId" TEXT;

-- AlterTable
ALTER TABLE "MicroLearning" ADD COLUMN     "schedulingTaskId" TEXT;

-- AlterTable
ALTER TABLE "PracticeQuiz" ADD COLUMN     "schedulingTaskId" TEXT;
