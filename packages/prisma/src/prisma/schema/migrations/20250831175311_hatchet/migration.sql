-- AlterTable
ALTER TABLE "public"."GroupActivity" ADD COLUMN     "scheduledCompletionTaskId" TEXT,
ADD COLUMN     "scheduledPublicationTaskId" TEXT;

-- AlterTable
ALTER TABLE "public"."LiveQuiz" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "scheduledPublicationTaskId" TEXT;

-- AlterTable
ALTER TABLE "public"."MicroLearning" ADD COLUMN     "scheduledCompletionTaskId" TEXT,
ADD COLUMN     "scheduledPublicationTaskId" TEXT;

-- AlterTable
ALTER TABLE "public"."PracticeQuiz" ADD COLUMN     "scheduledPublicationTaskId" TEXT;
