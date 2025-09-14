/*
  Warnings:

  - You are about to drop the `_ElementAnswerCollectionSolutions` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterEnum
ALTER TYPE "ElementType" ADD VALUE 'CASE_STUDY';

-- DropForeignKey
ALTER TABLE "_ElementAnswerCollectionSolutions" DROP CONSTRAINT "_ElementAnswerCollectionSolutions_A_fkey";

-- DropForeignKey
ALTER TABLE "_ElementAnswerCollectionSolutions" DROP CONSTRAINT "_ElementAnswerCollectionSolutions_B_fkey";

-- DropTable
DROP TABLE "_ElementAnswerCollectionSolutions";

-- CreateTable
CREATE TABLE "_ElementAnswerCollectionUsedItems" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_ElementAnswerCollectionUsedItems_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_ElementAnswerCollectionUsedItems_B_index" ON "_ElementAnswerCollectionUsedItems"("B");

-- AddForeignKey
ALTER TABLE "_ElementAnswerCollectionUsedItems" ADD CONSTRAINT "_ElementAnswerCollectionUsedItems_A_fkey" FOREIGN KEY ("A") REFERENCES "AnswerCollectionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ElementAnswerCollectionUsedItems" ADD CONSTRAINT "_ElementAnswerCollectionUsedItems_B_fkey" FOREIGN KEY ("B") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
