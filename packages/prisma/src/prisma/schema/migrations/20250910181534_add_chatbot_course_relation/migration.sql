/*
  Warnings:

  - Added the required column `courseId` to the `Chatbot` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "public"."Chatbot" ADD COLUMN     "courseId" UUID NOT NULL;

-- AddForeignKey
ALTER TABLE "public"."Chatbot" ADD CONSTRAINT "Chatbot_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
