/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `Participant` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Participation" DROP CONSTRAINT "Participation_courseLeaderboardId_fkey";

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "email" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isEmailValid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isProfilePublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isSSOAccount" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Participation" ALTER COLUMN "isActive" SET DEFAULT false;

-- AlterTable
ALTER TABLE "QuestionResponse" ALTER COLUMN "totalPointsAwarded" DROP NOT NULL;

-- AlterTable
ALTER TABLE "QuestionResponseDetail" ALTER COLUMN "pointsAwarded" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Participant_email_key" ON "Participant"("email");

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_courseLeaderboardId_fkey" FOREIGN KEY ("courseLeaderboardId") REFERENCES "LeaderboardEntry"("id") ON DELETE SET NULL ON UPDATE SET NULL;
