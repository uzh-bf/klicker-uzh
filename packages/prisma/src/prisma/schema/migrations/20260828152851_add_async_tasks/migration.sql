-- CreateEnum
CREATE TYPE "public"."AsyncTaskKind" AS ENUM ('COURSE_DUPLICATION', 'KNOWLEDGE_GRAPH_GENERATION', 'QUESTION_GENERATION');

-- CreateEnum
CREATE TYPE "public"."AsyncTaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."AsyncTask" (
    "id" UUID NOT NULL,
    "kind" "public"."AsyncTaskKind" NOT NULL,
    "status" "public"."AsyncTaskStatus" NOT NULL DEFAULT 'QUEUED',
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
CREATE INDEX "AsyncTask_ownerId_status_createdAt_idx" ON "public"."AsyncTask"("ownerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AsyncTask_ownerId_finishedAt_idx" ON "public"."AsyncTask"("ownerId", "finishedAt");

-- AddForeignKey
ALTER TABLE "public"."AsyncTask" ADD CONSTRAINT "AsyncTask_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
