-- CreateEnum
CREATE TYPE "ChangelogType" AS ENUM ('MESSAGE', 'MODIFICATION');

-- CreateTable
CREATE TABLE "ChangelogEntry" (
    "id" SERIAL NOT NULL,
    "type" "ChangelogType" NOT NULL,
    "message" TEXT NOT NULL,
    "userId" UUID,
    "answerCollectionId" INTEGER,
    "elementId" INTEGER,
    "courseId" UUID,
    "liveQuizId" UUID,
    "practiceQuizId" UUID,
    "microLearningId" UUID,
    "groupActivityId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangelogEntry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ObjectRequired" CHECK (("answerCollectionId" IS NOT NULL) OR ("elementId" IS NOT NULL) OR ("courseId" IS NOT NULL) OR ("liveQuizId" IS NOT NULL) OR ("practiceQuizId" IS NOT NULL) OR ("microLearningId" IS NOT NULL) OR ("groupActivityId" IS NOT NULL))
);

-- AddForeignKey
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_answerCollectionId_fkey" FOREIGN KEY ("answerCollectionId") REFERENCES "AnswerCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangelogEntry" ADD CONSTRAINT "ChangelogEntry_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

