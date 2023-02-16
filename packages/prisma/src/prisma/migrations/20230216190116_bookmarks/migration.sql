-- CreateTable
CREATE TABLE "_ParticipationToQuestionInstance" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_ParticipationToQuestionInstance_AB_unique" ON "_ParticipationToQuestionInstance"("A", "B");

-- CreateIndex
CREATE INDEX "_ParticipationToQuestionInstance_B_index" ON "_ParticipationToQuestionInstance"("B");

-- AddForeignKey
ALTER TABLE "_ParticipationToQuestionInstance" ADD CONSTRAINT "_ParticipationToQuestionInstance_A_fkey" FOREIGN KEY ("A") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipationToQuestionInstance" ADD CONSTRAINT "_ParticipationToQuestionInstance_B_fkey" FOREIGN KEY ("B") REFERENCES "QuestionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
