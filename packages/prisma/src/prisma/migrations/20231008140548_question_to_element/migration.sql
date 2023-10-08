ALTER TABLE "Question" RENAME TO "Element";
ALTER TABLE "QuestionInstance" RENAME TO "ElementInstance";
ALTER TABLE "QuestionStack" RENAME TO "ElementStack";
ALTER TABLE "QuestionResponse" RENAME TO "ElementResponse";
ALTER TABLE "QuestionResponseDetail" RENAME TO "ElementResponseDetail";
ALTER TABLE "_ParticipationToQuestionInstance" RENAME TO "_ParticipationToElementInstance";
ALTER TABLE "_ParticipationToQuestionStack" RENAME TO "_ParticipationToElementStack";
ALTER TABLE "_QuestionToTag" RENAME TO "_ElementToTag";

ALTER TYPE "QuestionType" RENAME TO "ElementType";
ALTER TYPE "QuestionInstanceType" RENAME TO "ElementInstanceType";
ALTER TYPE "QuestionStackType" RENAME TO "ElementStackType";
