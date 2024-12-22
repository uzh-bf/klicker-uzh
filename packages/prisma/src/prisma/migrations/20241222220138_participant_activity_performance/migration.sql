-- CreateTable
CREATE TABLE "ParticipantActivityPerformance" (
    "id" SERIAL NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "completion" REAL NOT NULL,
    "participantId" UUID NOT NULL,
    "practiceQuizId" UUID,
    "microLearningId" UUID,

    CONSTRAINT "ParticipantActivityPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantActivityPerformance_practiceQuizId_key" ON "ParticipantActivityPerformance"("practiceQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantActivityPerformance_microLearningId_key" ON "ParticipantActivityPerformance"("microLearningId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantActivityPerformance_participantId_practiceQuizId_key" ON "ParticipantActivityPerformance"("participantId", "practiceQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantActivityPerformance_participantId_microLearningI_key" ON "ParticipantActivityPerformance"("participantId", "microLearningId");

-- AddForeignKey
ALTER TABLE "ParticipantActivityPerformance" ADD CONSTRAINT "ParticipantActivityPerformance_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantActivityPerformance" ADD CONSTRAINT "ParticipantActivityPerformance_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantActivityPerformance" ADD CONSTRAINT "ParticipantActivityPerformance_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
