-- AlterTable
ALTER TABLE "ElementInstance" ADD COLUMN     "isVersionOutdated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GroupActivity" ADD COLUMN     "areInstancesOutdated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LiveQuiz" ADD COLUMN     "areInstancesOutdated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MicroLearning" ADD COLUMN     "areInstancesOutdated" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PracticeQuiz" ADD COLUMN     "areInstancesOutdated" BOOLEAN NOT NULL DEFAULT false;
