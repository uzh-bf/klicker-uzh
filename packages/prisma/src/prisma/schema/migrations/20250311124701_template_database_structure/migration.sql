-- AlterEnum
ALTER TYPE "PublicationStatus" ADD VALUE 'TEMPLATE';

-- CreateTable
CREATE TABLE "ActivityTemplate" (
    "id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "liveQuizId" UUID,
    "practiceQuizId" UUID,
    "microLearningId" UUID,
    "groupActivityId" UUID,

    CONSTRAINT "ActivityTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ActivityRequired" CHECK (("liveQuizId" IS NOT NULL) OR ("practiceQuizId" IS NOT NULL) OR ("microLearningId" IS NOT NULL) OR ("groupActivityId" IS NOT NULL))
);

-- CreateTable
CREATE TABLE "_TemplateAnswerCollectionUsages" (
    "A" UUID NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_TemplateAnswerCollectionUsages_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplate_liveQuizId_key" ON "ActivityTemplate"("liveQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplate_practiceQuizId_key" ON "ActivityTemplate"("practiceQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplate_microLearningId_key" ON "ActivityTemplate"("microLearningId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityTemplate_groupActivityId_key" ON "ActivityTemplate"("groupActivityId");

-- CreateIndex
CREATE INDEX "_TemplateAnswerCollectionUsages_B_index" ON "_TemplateAnswerCollectionUsages"("B");

-- AddForeignKey
ALTER TABLE "ActivityTemplate" ADD CONSTRAINT "ActivityTemplate_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTemplate" ADD CONSTRAINT "ActivityTemplate_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTemplate" ADD CONSTRAINT "ActivityTemplate_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityTemplate" ADD CONSTRAINT "ActivityTemplate_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TemplateAnswerCollectionUsages" ADD CONSTRAINT "_TemplateAnswerCollectionUsages_A_fkey" FOREIGN KEY ("A") REFERENCES "ActivityTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TemplateAnswerCollectionUsages" ADD CONSTRAINT "_TemplateAnswerCollectionUsages_B_fkey" FOREIGN KEY ("B") REFERENCES "AnswerCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
