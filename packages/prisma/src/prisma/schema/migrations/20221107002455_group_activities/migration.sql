/*
  Warnings:

  - A unique constraint covering the columns `[type,groupActivityId,order]` on the table `QuestionInstance` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ParameterType" AS ENUM ('NUMBER', 'STRING');

-- AlterEnum
ALTER TYPE "QuestionInstanceType" ADD VALUE 'GROUP_ACTIVITY';

-- AlterTable
ALTER TABLE "QuestionInstance" ADD COLUMN     "groupActivityId" UUID;

-- CreateTable
CREATE TABLE "GroupActivityParameter" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" "ParameterType" NOT NULL,
    "options" TEXT[],
    "unit" TEXT,
    "groupActivityId" UUID NOT NULL,

    CONSTRAINT "GroupActivityParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupActivityClue" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" "ParameterType" NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "groupActivityId" UUID NOT NULL,

    CONSTRAINT "GroupActivityClue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupActivityClueInstance" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "type" "ParameterType" NOT NULL,
    "value" TEXT NOT NULL,
    "unit" TEXT,
    "groupActivityInstanceId" INTEGER NOT NULL,

    CONSTRAINT "GroupActivityClueInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupActivity" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "scheduledStartAt" TIMESTAMP(3) NOT NULL,
    "scheduledEndAt" TIMESTAMP(3) NOT NULL,
    "ownerId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupActivityClueAssignment" (
    "id" SERIAL NOT NULL,
    "groupActivityClueInstanceId" INTEGER NOT NULL,
    "groupActivityInstanceId" INTEGER NOT NULL,
    "participantId" UUID NOT NULL,

    CONSTRAINT "GroupActivityClueAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupActivityInstance" (
    "id" SERIAL NOT NULL,
    "decisions" JSONB,
    "decisionsSubmittedAt" TIMESTAMP(3),
    "results" JSONB,
    "resultsComputedAt" TIMESTAMP(3),
    "groupActivityId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupActivityInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GroupActivityParameter_groupActivityId_name_key" ON "GroupActivityParameter"("groupActivityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GroupActivityClue_groupActivityId_name_key" ON "GroupActivityClue"("groupActivityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GroupActivityClueInstance_groupActivityInstanceId_name_key" ON "GroupActivityClueInstance"("groupActivityInstanceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "GroupActivityInstance_groupActivityId_groupId_key" ON "GroupActivityInstance"("groupActivityId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionInstance_type_groupActivityId_order_key" ON "QuestionInstance"("type", "groupActivityId", "order");

-- AddForeignKey
ALTER TABLE "QuestionInstance" ADD CONSTRAINT "QuestionInstance_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivityParameter" ADD CONSTRAINT "GroupActivityParameter_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivityClue" ADD CONSTRAINT "GroupActivityClue_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivityClueInstance" ADD CONSTRAINT "GroupActivityClueInstance_groupActivityInstanceId_fkey" FOREIGN KEY ("groupActivityInstanceId") REFERENCES "GroupActivityInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivity" ADD CONSTRAINT "GroupActivity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivity" ADD CONSTRAINT "GroupActivity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivityClueAssignment" ADD CONSTRAINT "GroupActivityClueAssignment_groupActivityClueInstanceId_fkey" FOREIGN KEY ("groupActivityClueInstanceId") REFERENCES "GroupActivityClueInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivityClueAssignment" ADD CONSTRAINT "GroupActivityClueAssignment_groupActivityInstanceId_fkey" FOREIGN KEY ("groupActivityInstanceId") REFERENCES "GroupActivityInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivityClueAssignment" ADD CONSTRAINT "GroupActivityClueAssignment_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivityInstance" ADD CONSTRAINT "GroupActivityInstance_groupActivityId_fkey" FOREIGN KEY ("groupActivityId") REFERENCES "GroupActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupActivityInstance" ADD CONSTRAINT "GroupActivityInstance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ParticipantGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
