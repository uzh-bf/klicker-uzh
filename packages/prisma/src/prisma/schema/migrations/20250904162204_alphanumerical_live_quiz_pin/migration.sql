/*
  Warnings:

  - A unique constraint covering the columns `[pinCode]` on the table `LiveQuiz` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."LiveQuiz" ALTER COLUMN "pinCode" SET DATA TYPE TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LiveQuiz_pinCode_key" ON "public"."LiveQuiz"("pinCode");

-- Enforce pinCode when assessment mode is enabled
ALTER TABLE "public"."LiveQuiz"
ADD CONSTRAINT "LiveQuiz_pin_required_when_assessment"
CHECK (NOT "isAssessmentEnabled" OR "pinCode" IS NOT NULL);