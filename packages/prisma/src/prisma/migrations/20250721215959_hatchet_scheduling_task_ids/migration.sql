-- AlterTable
ALTER TABLE "GroupActivity" ADD COLUMN     "scheduledTaskId" TEXT;

-- AlterTable
ALTER TABLE "LiveQuiz" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "scheduledTaskId" TEXT;

-- AlterTable
ALTER TABLE "MicroLearning" ADD COLUMN     "scheduledTaskId" TEXT;

-- AlterTable
ALTER TABLE "PracticeQuiz" ADD COLUMN     "scheduledTaskId" TEXT;
