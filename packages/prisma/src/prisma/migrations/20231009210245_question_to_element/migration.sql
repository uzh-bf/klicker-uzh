-- AlterTable
ALTER TABLE "Question" RENAME TO "Element";

-- AlterTable
ALTER TABLE "_QuestionToTag" RENAME TO "_ElementToTag";

-- AlterTable
ALTER TABLE "Element" RENAME CONSTRAINT "Question_pkey" TO "Element_pkey";

-- RenameForeignKey
ALTER TABLE "Element" RENAME CONSTRAINT "Question_ownerId_fkey" TO "Element_ownerId_fkey";

-- RenameIndex
ALTER INDEX "Question_originalId_key" RENAME TO "Element_originalId_key";

-- RenameIndex
ALTER INDEX "_QuestionToTag_AB_unique" RENAME TO "_ElementToTag_AB_unique";

-- RenameIndex
ALTER INDEX "_QuestionToTag_B_index" RENAME TO "_ElementToTag_B_index";

-- AlterEnum
ALTER TYPE "QuestionType" RENAME TO "ElementType";
ALTER TYPE "ElementType" ADD VALUE 'CONTENT';
ALTER TYPE "ElementType" ADD VALUE 'FLASHCARD';
ALTER TYPE "ElementType" ADD VALUE 'QUESTION_SC';
ALTER TYPE "ElementType" ADD VALUE 'QUESTION_MC';
ALTER TYPE "ElementType" ADD VALUE 'QUESTION_KPRIM';
ALTER TYPE "ElementType" ADD VALUE 'QUESTION_FREE_TEXT';
ALTER TYPE "ElementType" ADD VALUE 'QUESTION_NUMERICAL';
