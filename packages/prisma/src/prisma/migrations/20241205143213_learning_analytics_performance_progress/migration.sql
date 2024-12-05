-- CreateEnum
CREATE TYPE "PerformanceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "ParticipantPerformance" (
    "id" SERIAL NOT NULL,
    "firstErrorRate" REAL NOT NULL,
    "firstPerformance" "PerformanceLevel" NOT NULL,
    "lastErrorRate" REAL NOT NULL,
    "lastPerformance" "PerformanceLevel" NOT NULL,
    "totalErrorRate" REAL NOT NULL,
    "totalPerformance" "PerformanceLevel" NOT NULL,
    "participantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstancePerformance" (
    "id" SERIAL NOT NULL,
    "firstErrorRate" REAL,
    "firstPartialRate" REAL,
    "firstCorrectRate" REAL,
    "lastErrorRate" REAL,
    "lastPartialRate" REAL,
    "lastCorrectRate" REAL,
    "totalErrorRate" REAL NOT NULL,
    "totalPartialRate" REAL NOT NULL,
    "totalCorrectRate" REAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstancePerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityPerformance" (
    "id" SERIAL NOT NULL,
    "firstErrorRate" REAL,
    "firstPartialRate" REAL,
    "firstCorrectRate" REAL,
    "lastErrorRate" REAL,
    "lastPartialRate" REAL,
    "lastCorrectRate" REAL,
    "totalErrorRate" REAL NOT NULL,
    "totalPartialRate" REAL NOT NULL,
    "totalCorrectRate" REAL NOT NULL,
    "practiceQuizId" UUID,
    "microLearningId" UUID,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityProgress" (
    "id" SERIAL NOT NULL,
    "totalCourseParticipants" INTEGER NOT NULL,
    "startedCount" INTEGER NOT NULL,
    "completedCount" INTEGER NOT NULL,
    "repeatedCount" INTEGER,
    "practiceQuizId" UUID,
    "microLearningId" UUID,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ActivityProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InstancePerformance_instanceId_key" ON "InstancePerformance"("instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityPerformance_practiceQuizId_key" ON "ActivityPerformance"("practiceQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityPerformance_microLearningId_key" ON "ActivityPerformance"("microLearningId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityProgress_practiceQuizId_key" ON "ActivityProgress"("practiceQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityProgress_microLearningId_key" ON "ActivityProgress"("microLearningId");

-- AddForeignKey
ALTER TABLE "ParticipantPerformance" ADD CONSTRAINT "ParticipantPerformance_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantPerformance" ADD CONSTRAINT "ParticipantPerformance_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstancePerformance" ADD CONSTRAINT "InstancePerformance_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "ElementInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstancePerformance" ADD CONSTRAINT "InstancePerformance_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPerformance" ADD CONSTRAINT "ActivityPerformance_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPerformance" ADD CONSTRAINT "ActivityPerformance_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityPerformance" ADD CONSTRAINT "ActivityPerformance_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityProgress" ADD CONSTRAINT "ActivityProgress_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityProgress" ADD CONSTRAINT "ActivityProgress_microLearningId_fkey" FOREIGN KEY ("microLearningId") REFERENCES "MicroLearning"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityProgress" ADD CONSTRAINT "ActivityProgress_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
