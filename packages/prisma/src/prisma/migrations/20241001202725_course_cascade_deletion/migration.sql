/*
  Warnings:

  - Made the column `courseId` on table `ParticipantGroup` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "LeaderboardEntry" DROP CONSTRAINT "LeaderboardEntry_courseId_fkey";

-- DropForeignKey
ALTER TABLE "ParticipantGroup" DROP CONSTRAINT "ParticipantGroup_courseId_fkey";

-- AlterTable
ALTER TABLE "ParticipantGroup" ALTER COLUMN "courseId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "ParticipantGroup" ADD CONSTRAINT "ParticipantGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
