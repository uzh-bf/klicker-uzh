/*
  Warnings:

  - The values [PRIVATE] on the enum `ObjectAccess` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `access` on the `AnswerCollection` table. All the data in the column will be lost.
  - You are about to drop the column `catalogCollectionId` on the `AnswerCollection` table. All the data in the column will be lost.

*/

-- DropForeignKey
ALTER TABLE "AnswerCollection" DROP CONSTRAINT "AnswerCollection_catalogCollectionId_fkey";

-- AlterTable
ALTER TABLE "AnswerCollection" DROP COLUMN "access",
DROP COLUMN "catalogCollectionId";

-- AlterEnum
BEGIN;
DROP TYPE "ObjectAccess";
CREATE TYPE "ObjectAccess" AS ENUM ('RESTRICTED', 'PUBLIC');
COMMIT;

-- CreateTable
CREATE TABLE "CatalogCollectionAssignment" (
    "id" SERIAL NOT NULL,
    "access" "ObjectAccess" NOT NULL DEFAULT 'RESTRICTED',
    "catalogCollectionId" UUID NOT NULL,
    "answerCollectionId" INTEGER,
    "elementId" INTEGER,
    "courseId" UUID,
    "liveQuizId" UUID,
    "practiceQuizId" UUID,
    "microLearningId" UUID,
    "groupActivityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogCollectionAssignment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ObjectRequired" CHECK (("answerCollectionId" IS NOT NULL) OR ("elementId" IS NOT NULL) OR ("courseId" IS NOT NULL) OR ("liveQuizId" IS NOT NULL) OR ("practiceQuizId" IS NOT NULL) OR ("microLearningId" IS NOT NULL) OR ("groupActivityId" IS NOT NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollectionAssignment_answerCollectionId_catalogColle_key" ON "CatalogCollectionAssignment"("answerCollectionId", "catalogCollectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollectionAssignment_elementId_catalogCollectionId_key" ON "CatalogCollectionAssignment"("elementId", "catalogCollectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollectionAssignment_courseId_catalogCollectionId_key" ON "CatalogCollectionAssignment"("courseId", "catalogCollectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollectionAssignment_liveQuizId_catalogCollectionId_key" ON "CatalogCollectionAssignment"("liveQuizId", "catalogCollectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollectionAssignment_practiceQuizId_catalogCollectio_key" ON "CatalogCollectionAssignment"("practiceQuizId", "catalogCollectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollectionAssignment_microLearningId_catalogCollecti_key" ON "CatalogCollectionAssignment"("microLearningId", "catalogCollectionId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogCollectionAssignment_groupActivityId_catalogCollecti_key" ON "CatalogCollectionAssignment"("groupActivityId", "catalogCollectionId");

-- AddForeignKey
ALTER TABLE "CatalogCollectionAssignment" ADD CONSTRAINT "CatalogCollectionAssignment_catalogCollectionId_fkey" FOREIGN KEY ("catalogCollectionId") REFERENCES "CatalogCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCollectionAssignment" ADD CONSTRAINT "CatalogCollectionAssignment_answerCollectionId_fkey" FOREIGN KEY ("answerCollectionId") REFERENCES "AnswerCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCollectionAssignment" ADD CONSTRAINT "CatalogCollectionAssignment_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCollectionAssignment" ADD CONSTRAINT "CatalogCollectionAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCollectionAssignment" ADD CONSTRAINT "CatalogCollectionAssignment_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCollectionAssignment" ADD CONSTRAINT "CatalogCollectionAssignment_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCollectionAssignment" ADD CONSTRAINT "CatalogCollectionAssignment_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogCollectionAssignment" ADD CONSTRAINT "CatalogCollectionAssignment_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
