-- CreateTable
CREATE TABLE "_AdditionalAssignmentLeaves" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_AdditionalAssignmentLeaves_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_AdditionalAssignmentLeaves_B_index" ON "_AdditionalAssignmentLeaves"("B");

-- AddForeignKey
ALTER TABLE "_AdditionalAssignmentLeaves" ADD CONSTRAINT "_AdditionalAssignmentLeaves_A_fkey" FOREIGN KEY ("A") REFERENCES "CompetenceTreeElementAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AdditionalAssignmentLeaves" ADD CONSTRAINT "_AdditionalAssignmentLeaves_B_fkey" FOREIGN KEY ("B") REFERENCES "CompetenceTreeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
