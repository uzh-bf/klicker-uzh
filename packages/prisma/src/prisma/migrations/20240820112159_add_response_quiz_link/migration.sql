-- AlterTable
ALTER TABLE "QuestionResponse" ADD COLUMN     "microLearningId" UUID,
ADD COLUMN     "practiceQuizId" UUID;

-- AlterTable
ALTER TABLE "QuestionResponseDetail" ADD COLUMN     "microLearningId" UUID,
ADD COLUMN     "practiceQuizId" UUID;

-- CreateIndex
CREATE INDEX "QuestionResponse_practiceQuizId_idx" ON "QuestionResponse"("practiceQuizId");

-- CreateIndex
CREATE INDEX "QuestionResponse_microLearningId_idx" ON "QuestionResponse"("microLearningId");

-- CreateIndex
CREATE INDEX "QuestionResponse_practiceQuizId_participantId_idx" ON "QuestionResponse"("practiceQuizId", "participantId");

-- CreateIndex
CREATE INDEX "QuestionResponse_microLearningId_participantId_idx" ON "QuestionResponse"("microLearningId", "participantId");

-- CreateIndex
CREATE INDEX "QuestionResponseDetail_practiceQuizId_idx" ON "QuestionResponseDetail"("practiceQuizId");

-- CreateIndex
CREATE INDEX "QuestionResponseDetail_microLearningId_idx" ON "QuestionResponseDetail"("microLearningId");

-- CreateIndex
CREATE INDEX "QuestionResponseDetail_practiceQuizId_participantId_idx" ON "QuestionResponseDetail"("practiceQuizId", "participantId");

-- CreateIndex
CREATE INDEX "QuestionResponseDetail_microLearningId_participantId_idx" ON "QuestionResponseDetail"("microLearningId", "participantId");

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponseDetail" ADD CONSTRAINT "QuestionResponseDetail_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponseDetail" ADD CONSTRAINT "QuestionResponseDetail_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;
