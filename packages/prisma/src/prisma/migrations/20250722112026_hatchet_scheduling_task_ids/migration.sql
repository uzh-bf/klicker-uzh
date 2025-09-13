-- AlterTable
ALTER TABLE "GroupActivity" ADD COLUMN     "scheduledCompletionTaskId" TEXT,
ADD COLUMN     "scheduledPublicationTaskId" TEXT;

-- AlterTable
ALTER TABLE "LiveQuiz" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "scheduledPublicationTaskId" TEXT;

-- AlterTable
ALTER TABLE "MicroLearning" ADD COLUMN     "scheduledCompletionTaskId" TEXT,
ADD COLUMN     "scheduledPublicationTaskId" TEXT;

-- AlterTable
ALTER TABLE "PracticeQuiz" ADD COLUMN     "scheduledPublicationTaskId" TEXT;
