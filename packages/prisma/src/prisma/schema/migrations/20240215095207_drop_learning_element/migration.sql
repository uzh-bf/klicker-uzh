/*
  Warnings:

  - You are about to drop the column `learningElementId` on the `QuestionStack` table. All the data in the column will be lost.
  - You are about to drop the `LearningElement` table. If the table is not empty, all the data it contains will be lost.

*/

-- Delete all existing learning elements (to ensure cascading delete of stacks and question instances)
DELETE FROM "LearningElement";

-- DropForeignKey
ALTER TABLE "LearningElement" DROP CONSTRAINT "LearningElement_courseId_fkey";

-- DropForeignKey
ALTER TABLE "LearningElement" DROP CONSTRAINT "LearningElement_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionStack" DROP CONSTRAINT "QuestionStack_learningElementId_fkey";

-- DropIndex
DROP INDEX "QuestionStack_type_learningElementId_order_key";

-- AlterTable
ALTER TABLE "QuestionStack" DROP COLUMN "learningElementId";

-- DropTable
DROP TABLE "LearningElement";

-- DropEnum
DROP TYPE "LearningElementStatus";

-- DropEnum
DROP TYPE "OrderType";
