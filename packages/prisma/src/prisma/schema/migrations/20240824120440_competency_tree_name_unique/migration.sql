/*
  Warnings:

  - A unique constraint covering the columns `[treeId,name]` on the table `Competency` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Competency_treeId_name_key" ON "Competency"("treeId", "name");
