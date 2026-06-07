-- CreateEnum
CREATE TYPE "OfflinePracticeAttemptSyncStatus" AS ENUM ('ACCEPTED', 'STALE_REVISION', 'NO_LONGER_AUTHORIZED', 'SERVER_ERROR');

-- CreateTable
CREATE TABLE "OfflinePracticeAttemptSync" (
    "id" SERIAL NOT NULL,
    "clientAttemptId" TEXT NOT NULL,
    "attemptHash" VARCHAR(64) NOT NULL,
    "practiceQuizId" UUID NOT NULL,
    "quizRevision" TEXT NOT NULL,
    "stackId" INTEGER NOT NULL,
    "status" "OfflinePracticeAttemptSyncStatus" NOT NULL,
    "serverFeedback" JSONB,
    "errorMessage" TEXT,
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfflinePracticeAttemptSync_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OfflinePracticeAttemptSync_participantId_clientAttemptId_key" ON "OfflinePracticeAttemptSync"("participantId", "clientAttemptId");

-- AddForeignKey
ALTER TABLE "OfflinePracticeAttemptSync" ADD CONSTRAINT "OfflinePracticeAttemptSync_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
