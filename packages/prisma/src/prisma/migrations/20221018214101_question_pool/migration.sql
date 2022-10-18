/*
  Warnings:

  - You are about to drop the column `contentPlain` on the `Question` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[ownerId,name]` on the table `Tag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `name` to the `Tag` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Question" DROP COLUMN "contentPlain",
ADD COLUMN     "hasAnswerFeedbacks" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasSampleSolution" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN     "name" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Tag_ownerId_name_key" ON "Tag"("ownerId", "name");
