-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "learnerMemoryEpoch" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "LearnerMemoryForgetRequest" (
    "id" SERIAL NOT NULL,
    "learnerKey" TEXT NOT NULL,
    "courseId" UUID,
    "epoch" INTEGER NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),

    CONSTRAINT "LearnerMemoryForgetRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LearnerMemoryForgetRequest_completedAt_idx" ON "LearnerMemoryForgetRequest"("completedAt");

-- CreateIndex
CREATE INDEX "LearnerMemoryForgetRequest_learnerKey_courseId_idx" ON "LearnerMemoryForgetRequest"("learnerKey", "courseId");
