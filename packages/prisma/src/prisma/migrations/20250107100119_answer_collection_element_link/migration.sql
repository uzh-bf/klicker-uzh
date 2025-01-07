/*
  Warnings:

  - Added the required column `updatedAt` to the `AnswerCollectionEntry` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "ElementType" ADD VALUE 'SELECTION';

-- AlterTable
ALTER TABLE "AnswerCollection" ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AnswerCollectionEntry" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Element" ADD COLUMN     "answerCollectionId" INTEGER;

-- CreateTable
CREATE TABLE "_ElementAnswerCollectionSolutions" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ElementAnswerCollectionSolutions_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ElementAnswerCollectionSolutions_B_index" ON "_ElementAnswerCollectionSolutions"("B");

-- AddForeignKey
ALTER TABLE "Element" ADD CONSTRAINT "Element_answerCollectionId_fkey" FOREIGN KEY ("answerCollectionId") REFERENCES "AnswerCollection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ElementAnswerCollectionSolutions" ADD CONSTRAINT "_ElementAnswerCollectionSolutions_A_fkey" FOREIGN KEY ("A") REFERENCES "AnswerCollectionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ElementAnswerCollectionSolutions" ADD CONSTRAINT "_ElementAnswerCollectionSolutions_B_fkey" FOREIGN KEY ("B") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
