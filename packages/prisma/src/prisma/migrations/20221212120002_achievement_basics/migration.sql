-- CreateEnum
CREATE TYPE "AchievementType" AS ENUM ('PARTICIPANT', 'GROUP', 'CLASS');

-- CreateEnum
CREATE TYPE "AchievementScope" AS ENUM ('GLOBAL', 'COURSE');

-- AlterTable
ALTER TABLE "MicroSession" ADD COLUMN     "pointsMultiplier" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "level" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "pointsMultiplier" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "Title" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Title_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "iconColor" TEXT,
    "rewardedPoints" INTEGER,
    "rewardedXP" INTEGER,
    "type" "AchievementType" NOT NULL,
    "scope" "AchievementScope" NOT NULL DEFAULT 'GLOBAL',
    "courseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantAchievementInstance" (
    "id" SERIAL NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "achievedCount" INTEGER NOT NULL DEFAULT 1,
    "achievementId" INTEGER NOT NULL,
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantAchievementInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupAchievementInstance" (
    "id" SERIAL NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "achievedCount" INTEGER NOT NULL DEFAULT 1,
    "achievementId" INTEGER NOT NULL,
    "groupId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupAchievementInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassAchievementInstance" (
    "id" SERIAL NOT NULL,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "achievedCount" INTEGER NOT NULL DEFAULT 1,
    "achievementId" INTEGER NOT NULL,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassAchievementInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ParticipantToTitle" (
    "A" UUID NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_AchievementToTitle" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Title_courseId_name_key" ON "Title"("courseId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantAchievementInstance_participantId_achievementId_key" ON "ParticipantAchievementInstance"("participantId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupAchievementInstance_groupId_achievementId_key" ON "GroupAchievementInstance"("groupId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassAchievementInstance_courseId_achievementId_key" ON "ClassAchievementInstance"("courseId", "achievementId");

-- CreateIndex
CREATE UNIQUE INDEX "_ParticipantToTitle_AB_unique" ON "_ParticipantToTitle"("A", "B");

-- CreateIndex
CREATE INDEX "_ParticipantToTitle_B_index" ON "_ParticipantToTitle"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_AchievementToTitle_AB_unique" ON "_AchievementToTitle"("A", "B");

-- CreateIndex
CREATE INDEX "_AchievementToTitle_B_index" ON "_AchievementToTitle"("B");

-- AddForeignKey
ALTER TABLE "Title" ADD CONSTRAINT "Title_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAchievementInstance" ADD CONSTRAINT "ParticipantAchievementInstance_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAchievementInstance" ADD CONSTRAINT "ParticipantAchievementInstance_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAchievementInstance" ADD CONSTRAINT "GroupAchievementInstance_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupAchievementInstance" ADD CONSTRAINT "GroupAchievementInstance_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "ParticipantGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAchievementInstance" ADD CONSTRAINT "ClassAchievementInstance_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassAchievementInstance" ADD CONSTRAINT "ClassAchievementInstance_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipantToTitle" ADD CONSTRAINT "_ParticipantToTitle_A_fkey" FOREIGN KEY ("A") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipantToTitle" ADD CONSTRAINT "_ParticipantToTitle_B_fkey" FOREIGN KEY ("B") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AchievementToTitle" ADD CONSTRAINT "_AchievementToTitle_A_fkey" FOREIGN KEY ("A") REFERENCES "Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AchievementToTitle" ADD CONSTRAINT "_AchievementToTitle_B_fkey" FOREIGN KEY ("B") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;
