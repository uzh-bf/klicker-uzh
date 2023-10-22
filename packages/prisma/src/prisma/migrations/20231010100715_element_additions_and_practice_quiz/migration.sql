-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "ElementOrderType" AS ENUM ('SEQUENTIAL', 'SHUFFLED', 'LAST_RESPONSE');

-- CreateEnum
CREATE TYPE "ElementInstanceType" AS ENUM ('PRACTICE_QUIZ');

-- CreateEnum
CREATE TYPE "ElementStackType" AS ENUM ('LIVE_QUIZ', 'PRACTICE_QUIZ', 'MICROLEARNING', 'GROUP_ACTIVITY');

-- AlterTable
ALTER TABLE "Element" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "QuestionResponse" ADD COLUMN     "elementInstanceId" INTEGER,
ADD COLUMN     "aggregatedResponses" JSONB,
ADD COLUMN     "correctCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "correctCountStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastCorrectAt" TIMESTAMP(3),
ADD COLUMN     "partialCorrectCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastPartialCorrectAt" TIMESTAMP(3),
ADD COLUMN     "wrongCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastWrongAt" TIMESTAMP(3),
ALTER COLUMN "questionInstanceId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "QuestionResponseDetail" ADD COLUMN     "elementInstanceId" INTEGER,
ALTER COLUMN "questionInstanceId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ElementInstance" (
    "id" SERIAL NOT NULL,
    "originalId" TEXT,
    "type" "ElementInstanceType" NOT NULL,
    "elementType" "ElementType" NOT NULL,
    "order" INTEGER NOT NULL,
    "options" JSONB NOT NULL,
    "elementData" JSONB NOT NULL,
    "results" JSONB NOT NULL,
    "elementId" INTEGER,
    "elementStackId" INTEGER NOT NULL,
    "ownerId" UUID NOT NULL,
    "courseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ElementInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElementStack" (
    "id" SERIAL NOT NULL,
    "originalId" TEXT,
    "type" "ElementStackType" NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "order" INTEGER,
    "options" JSONB NOT NULL,
    "practiceQuizId" UUID,

    CONSTRAINT "ElementStack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeQuiz" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "pointsMultiplier" INTEGER NOT NULL DEFAULT 1,
    "resetTimeDays" INTEGER NOT NULL DEFAULT 6,
    "orderType" "ElementOrderType" NOT NULL DEFAULT 'SEQUENTIAL',
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" UUID NOT NULL,
    "courseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ElementInstanceToParticipation" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_ElementStackToParticipation" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "QuestionResponse_participantId_elementInstanceId_key" ON "QuestionResponse"("participantId", "elementInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementInstance_originalId_key" ON "ElementInstance"("originalId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementInstance_type_elementStackId_order_key" ON "ElementInstance"("type", "elementStackId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ElementStack_originalId_key" ON "ElementStack"("originalId");

-- CreateIndex
CREATE UNIQUE INDEX "ElementStack_type_practiceQuizId_order_key" ON "ElementStack"("type", "practiceQuizId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "_ElementInstanceToParticipation_AB_unique" ON "_ElementInstanceToParticipation"("A", "B");

-- CreateIndex
CREATE INDEX "_ElementInstanceToParticipation_B_index" ON "_ElementInstanceToParticipation"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ElementStackToParticipation_AB_unique" ON "_ElementStackToParticipation"("A", "B");

-- CreateIndex
CREATE INDEX "_ElementStackToParticipation_B_index" ON "_ElementStackToParticipation"("B");

-- AddForeignKey
ALTER TABLE "ElementInstance" ADD CONSTRAINT "ElementInstance_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementInstance" ADD CONSTRAINT "ElementInstance_elementStackId_fkey" FOREIGN KEY ("elementStackId") REFERENCES "ElementStack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementInstance" ADD CONSTRAINT "ElementInstance_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementInstance" ADD CONSTRAINT "ElementInstance_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementStack" ADD CONSTRAINT "ElementStack_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeQuiz" ADD CONSTRAINT "PracticeQuiz_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeQuiz" ADD CONSTRAINT "PracticeQuiz_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_elementInstanceId_fkey" FOREIGN KEY ("elementInstanceId") REFERENCES "ElementInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponseDetail" ADD CONSTRAINT "QuestionResponseDetail_elementInstanceId_fkey" FOREIGN KEY ("elementInstanceId") REFERENCES "ElementInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ElementInstanceToParticipation" ADD CONSTRAINT "_ElementInstanceToParticipation_A_fkey" FOREIGN KEY ("A") REFERENCES "ElementInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ElementInstanceToParticipation" ADD CONSTRAINT "_ElementInstanceToParticipation_B_fkey" FOREIGN KEY ("B") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ElementStackToParticipation" ADD CONSTRAINT "_ElementStackToParticipation_A_fkey" FOREIGN KEY ("A") REFERENCES "ElementStack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ElementStackToParticipation" ADD CONSTRAINT "_ElementStackToParticipation_B_fkey" FOREIGN KEY ("B") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
