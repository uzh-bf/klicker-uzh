/*
  Warnings:

  - Made the column `firstResponse` on table `QuestionResponse` required. This step will fail if there are existing NULL values in that column.
  - Made the column `firstResponseCorrectness` on table `QuestionResponse` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lastResponseCorrectness` on table `QuestionResponse` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "QuestionResponse" ALTER COLUMN "firstResponse" SET NOT NULL,
ALTER COLUMN "firstResponseCorrectness" SET NOT NULL,
ALTER COLUMN "lastResponseCorrectness" SET NOT NULL;
