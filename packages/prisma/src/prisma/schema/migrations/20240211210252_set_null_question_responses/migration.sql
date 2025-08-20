-- DropForeignKey
ALTER TABLE "QuestionResponse" DROP CONSTRAINT "QuestionResponse_questionInstanceId_fkey";

-- DropForeignKey
ALTER TABLE "QuestionResponseDetail" DROP CONSTRAINT "QuestionResponseDetail_questionInstanceId_fkey";

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_questionInstanceId_fkey" FOREIGN KEY ("questionInstanceId") REFERENCES "QuestionInstance"("id") ON DELETE SET NULL ON UPDATE SET NULL;

-- AddForeignKey
ALTER TABLE "QuestionResponseDetail" ADD CONSTRAINT "QuestionResponseDetail_questionInstanceId_fkey" FOREIGN KEY ("questionInstanceId") REFERENCES "QuestionInstance"("id") ON DELETE SET NULL ON UPDATE SET NULL;
