/*
  Warnings:

  - Made the column `courseId` on table `QuestionResponse` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "QuestionResponse" ALTER COLUMN "courseId" SET NOT NULL;
