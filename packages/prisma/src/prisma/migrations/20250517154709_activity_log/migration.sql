-- CreateEnum
CREATE TYPE "ActivityLogType" AS ENUM ('MESSAGE', 'MODIFICATION');

-- CreateTable
CREATE TABLE "ActivityLogEntry" (
    "id" SERIAL NOT NULL,
    "type" "ActivityLogType" NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
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

    CONSTRAINT "ActivityLogEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ActivityLogEntry" ADD CONSTRAINT "ActivityLogEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLogEntry" ADD CONSTRAINT "ActivityLogEntry_answerCollectionId_fkey" FOREIGN KEY ("answerCollectionId") REFERENCES "AnswerCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLogEntry" ADD CONSTRAINT "ActivityLogEntry_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLogEntry" ADD CONSTRAINT "ActivityLogEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLogEntry" ADD CONSTRAINT "ActivityLogEntry_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLogEntry" ADD CONSTRAINT "ActivityLogEntry_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLogEntry" ADD CONSTRAINT "ActivityLogEntry_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLogEntry" ADD CONSTRAINT "ActivityLogEntry_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
