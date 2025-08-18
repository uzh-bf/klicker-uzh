-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('INCOMPLETE', 'REVIEWED', 'MODIFIED_AFTER_REVIEW');

-- AlterTable
ALTER TABLE "GroupActivity" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'INCOMPLETE';

-- AlterTable
ALTER TABLE "LiveQuiz" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'INCOMPLETE';

-- AlterTable
ALTER TABLE "MicroLearning" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'INCOMPLETE';

-- AlterTable
ALTER TABLE "PracticeQuiz" ADD COLUMN     "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'INCOMPLETE';
