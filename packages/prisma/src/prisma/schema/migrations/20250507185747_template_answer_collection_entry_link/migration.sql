-- DropIndex
DROP INDEX "Element_ownerId_originalId_key";

-- DropIndex
DROP INDEX "LiveSession_ownerId_originalId_key";

-- CreateTable
CREATE TABLE "_TemplateAnswerCollectionUsedItems" (
    "A" UUID NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_TemplateAnswerCollectionUsedItems_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_TemplateAnswerCollectionUsedItems_B_index" ON "_TemplateAnswerCollectionUsedItems"("B");

-- AddForeignKey
ALTER TABLE "_TemplateAnswerCollectionUsedItems" ADD CONSTRAINT "_TemplateAnswerCollectionUsedItems_A_fkey" FOREIGN KEY ("A") REFERENCES "ActivityTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TemplateAnswerCollectionUsedItems" ADD CONSTRAINT "_TemplateAnswerCollectionUsedItems_B_fkey" FOREIGN KEY ("B") REFERENCES "AnswerCollectionEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
