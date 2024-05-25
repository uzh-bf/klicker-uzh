-- AlterEnum
ALTER TYPE "PublicationStatus" ADD VALUE 'SCHEDULED';

-- AlterTable
ALTER TABLE "PracticeQuiz" ADD COLUMN     "availableFrom" TIMESTAMP(3);
