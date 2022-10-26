/*
  Warnings:

  - A unique constraint covering the columns `[pinCode]` on the table `Course` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Course" ALTER COLUMN "pinCode" SET DEFAULT 123456789;

-- CreateIndex
CREATE UNIQUE INDEX "Course_pinCode_key" ON "Course"("pinCode");
