-- AlterTable
ALTER TABLE "GroupActivity" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MicroLearning" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PracticeQuiz" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
