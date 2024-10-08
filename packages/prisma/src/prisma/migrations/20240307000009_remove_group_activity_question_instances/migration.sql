/*
  Warnings:

  - You are about to drop the column `questionStackId` on the `GroupActivity` table. All the data in the column will be lost.
  - You are about to drop the column `groupActivityId` on the `QuestionInstance` table. All the data in the column will be lost.
  - You are about to drop the column `stackElementId` on the `QuestionInstance` table. All the data in the column will be lost.
  - You are about to drop the `QuestionStack` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StackElement` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "GroupActivity" DROP CONSTRAINT "GroupActivity_questionStackId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionInstance" DROP CONSTRAINT "QuestionInstance_groupActivityId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionInstance" DROP CONSTRAINT "QuestionInstance_stackElementId_fkey";

-- DropForeignKey
ALTER TABLE "StackElement" DROP CONSTRAINT "StackElement_stackId_fkey";

-- DropIndex
DROP INDEX "GroupActivity_questionStackId_key";

-- DropIndex
DROP INDEX "QuestionInstance_stackElementId_key";

-- DropIndex
DROP INDEX "QuestionInstance_type_groupActivityId_order_key";

-- DropIndex
DROP INDEX "QuestionInstance_type_stackElementId_order_key";

-- AlterTable
ALTER TABLE "GroupActivity" DROP COLUMN "questionStackId";

-- AlterTable
ALTER TABLE "QuestionInstance" DROP COLUMN "groupActivityId",
DROP COLUMN "stackElementId";

-- DropTable
DROP TABLE "QuestionStack";

-- DropTable
DROP TABLE "StackElement";

-- DropEnum
DROP TYPE "QuestionStackType";
