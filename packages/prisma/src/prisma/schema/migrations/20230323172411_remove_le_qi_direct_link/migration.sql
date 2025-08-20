/*
  Warnings:

  - You are about to drop the column `learningElementId` on the `QuestionInstance` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "QuestionInstance" DROP CONSTRAINT "QuestionInstance_learningElementId_fkey";

-- AlterTable
ALTER TABLE "QuestionInstance" DROP COLUMN "learningElementId";
