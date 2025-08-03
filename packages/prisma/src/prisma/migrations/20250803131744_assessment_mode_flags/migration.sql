-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "isAssessmentEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "GroupActivity" ADD COLUMN     "isAssessmentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isGamificationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LiveQuiz" ADD COLUMN     "isAssessmentEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "MicroLearning" ADD COLUMN     "isAssessmentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isGamificationEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PracticeQuiz" ADD COLUMN     "isAssessmentEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isGamificationEnabled" BOOLEAN NOT NULL DEFAULT false;
