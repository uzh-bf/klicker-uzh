/*
  Warnings:

  - Made the column `order` on table `ElementStack` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "ElementStack" ALTER COLUMN "order" SET NOT NULL;
