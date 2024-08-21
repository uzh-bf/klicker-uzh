-- AlterTable
ALTER TABLE "QuestionResponse" RENAME COLUMN "response" TO "lastResponse";
ALTER TABLE "QuestionResponse" RENAME COLUMN "responseCorrectness" TO "lastResponseCorrectness";
