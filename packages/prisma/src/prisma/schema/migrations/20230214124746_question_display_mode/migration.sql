-- CreateEnum
CREATE TYPE "QuestionDisplayMode" AS ENUM ('LIST', 'GRID');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "displayMode" "QuestionDisplayMode" NOT NULL DEFAULT 'LIST';
