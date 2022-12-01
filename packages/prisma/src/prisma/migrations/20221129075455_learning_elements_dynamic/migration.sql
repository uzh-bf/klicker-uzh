-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('SEQUENTIAL', 'SHUFFLED', 'LAST_RESPONSE');

-- DropForeignKey
ALTER TABLE "MicroSession" DROP CONSTRAINT "MicroSession_courseId_fkey";

-- AlterTable
ALTER TABLE "LearningElement" ADD COLUMN     "description" TEXT,
ADD COLUMN     "orderType" "OrderType" NOT NULL DEFAULT 'SEQUENTIAL',
ADD COLUMN     "pointsMultiplier" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "resetTimeDays" INTEGER NOT NULL DEFAULT 6,
ALTER COLUMN "courseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MicroSession" ALTER COLUMN "courseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "ParticipantGroup" ALTER COLUMN "courseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "pointsMultiplier" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "QuestionInstance" ADD COLUMN     "pointsMultiplier" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "resetTimeDays" INTEGER;

-- AddForeignKey
ALTER TABLE "MicroSession" ADD CONSTRAINT "MicroSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
