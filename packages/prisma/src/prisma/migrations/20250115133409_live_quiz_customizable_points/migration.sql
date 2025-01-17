-- AlterTable
ALTER TABLE "LiveQuiz" ADD COLUMN     "defaultCorrectPoints" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "defaultPoints" INTEGER NOT NULL DEFAULT 10;
