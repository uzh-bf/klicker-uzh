/*
  Warnings:

  - Made the column `anonymousResults` on table `ElementInstance` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ElementInstance" ALTER COLUMN "anonymousResults" SET NOT NULL;
