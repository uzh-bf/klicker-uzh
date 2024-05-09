-- AlterTable
ALTER TABLE "LiveQuiz" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;
