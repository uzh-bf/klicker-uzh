-- CreateTable
CREATE TABLE "QuestionResponseDetail" (
    "id" SERIAL NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pointsAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "response" JSONB NOT NULL,
    "participantId" UUID NOT NULL,
    "participationId" INTEGER NOT NULL,
    "questionInstanceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionResponseDetail_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "QuestionResponseDetail" ADD CONSTRAINT "QuestionResponseDetail_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponseDetail" ADD CONSTRAINT "QuestionResponseDetail_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponseDetail" ADD CONSTRAINT "QuestionResponseDetail_questionInstanceId_fkey" FOREIGN KEY ("questionInstanceId") REFERENCES "QuestionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
