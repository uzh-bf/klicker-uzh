/*
  Warnings:

  - You are about to drop the column `questionInstanceId` on the `QuestionResponse` table. All the data in the column will be lost.
  - You are about to drop the column `questionInstanceId` on the `QuestionResponseDetail` table. All the data in the column will be lost.
  - Made the column `elementInstanceId` on table `QuestionResponse` required. This step will fail if there are existing NULL values in that column.
  - Made the column `elementInstanceId` on table `QuestionResponseDetail` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "QuestionResponse" DROP CONSTRAINT "QuestionResponse_elementInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionResponse" DROP CONSTRAINT "QuestionResponse_questionInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionResponseDetail" DROP CONSTRAINT "QuestionResponseDetail_elementInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionResponseDetail" DROP CONSTRAINT "QuestionResponseDetail_questionInstanceId_fkey";

-- DropIndex
DROP INDEX "QuestionResponse_participantId_questionInstanceId_key";

-- AlterTable
ALTER TABLE "QuestionResponse" DROP COLUMN "questionInstanceId",
ALTER COLUMN "elementInstanceId" SET NOT NULL;

-- AlterTable
ALTER TABLE "QuestionResponseDetail" DROP COLUMN "questionInstanceId",
ALTER COLUMN "elementInstanceId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_elementInstanceId_fkey" FOREIGN KEY ("elementInstanceId") REFERENCES "ElementInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponseDetail" ADD CONSTRAINT "QuestionResponseDetail_elementInstanceId_fkey" FOREIGN KEY ("elementInstanceId") REFERENCES "ElementInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
