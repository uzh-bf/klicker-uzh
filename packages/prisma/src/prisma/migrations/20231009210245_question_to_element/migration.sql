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

-- AlterEnum
ALTER TYPE "QuestionDisplayMode" RENAME TO "ElementDisplayMode";
