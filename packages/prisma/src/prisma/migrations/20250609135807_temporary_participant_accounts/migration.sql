-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'TEMPORARY_PARTICIPANT';

-- CreateTable
CREATE TABLE "TemporaryLeaderboardEntry" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "avatar" TEXT,
    "quizId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemporaryLeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TemporaryLeaderboardEntry" ADD CONSTRAINT "TemporaryLeaderboardEntry_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
