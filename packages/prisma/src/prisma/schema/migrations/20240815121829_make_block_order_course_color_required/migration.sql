/*
  Warnings:

  - Made the column `color` on table `Course` required. This step will fail if there are existing NULL values in that column.
  - Made the column `order` on table `SessionBlock` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "color" SET NOT NULL;

-- AlterTable
ALTER TABLE "SessionBlock" ALTER COLUMN "order" SET NOT NULL;
