-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "competencyTreeId" INTEGER;

-- CreateTable
CREATE TABLE "CompetencyTree" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetencyTree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competency" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lft" INTEGER NOT NULL,
    "rgt" INTEGER NOT NULL,
    "treeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompetencyTree_ownerId_name_key" ON "CompetencyTree"("ownerId", "name");

-- CreateIndex
CREATE INDEX "Competency_treeId_lft_idx" ON "Competency"("treeId", "lft");

-- CreateIndex
CREATE INDEX "Competency_treeId_rgt_idx" ON "Competency"("treeId", "rgt");

-- CreateIndex
CREATE UNIQUE INDEX "Competency_treeId_lft_rgt_key" ON "Competency"("treeId", "lft", "rgt");

-- AddForeignKey
ALTER TABLE "CompetencyTree" ADD CONSTRAINT "CompetencyTree_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "CompetencyTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_competencyTreeId_fkey" FOREIGN KEY ("competencyTreeId") REFERENCES "CompetencyTree"("id") ON DELETE SET NULL ON UPDATE CASCADE;
