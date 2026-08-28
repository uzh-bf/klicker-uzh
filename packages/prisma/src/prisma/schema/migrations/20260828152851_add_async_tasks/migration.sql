-- CreateEnum
CREATE TYPE "AsyncTaskKind" AS ENUM ('COURSE_DUPLICATION', 'KNOWLEDGE_GRAPH_GENERATION', 'QUESTION_GENERATION');

-- CreateEnum
CREATE TYPE "AsyncTaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "AsyncTask" (
    "id" UUID NOT NULL,
    "kind" "AsyncTaskKind" NOT NULL,
    "status" "AsyncTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "subjectId" TEXT,
    "subjectName" TEXT NOT NULL,
    "targetName" TEXT,
    "resultId" TEXT,
    "errorCode" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AsyncTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AsyncTask_ownerId_status_createdAt_idx" ON "AsyncTask"("ownerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AsyncTask_ownerId_finishedAt_idx" ON "AsyncTask"("ownerId", "finishedAt");

-- AddForeignKey
ALTER TABLE "AsyncTask" ADD CONSTRAINT "AsyncTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
