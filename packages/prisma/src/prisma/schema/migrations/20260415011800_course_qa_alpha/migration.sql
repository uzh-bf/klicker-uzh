-- Branch-local final discussion migration.
--
-- The discussion feature has not been deployed from this branch, so this
-- migration creates the final shipped alpha schema directly instead of
-- preserving intermediate branch-only migration steps.

-- CreateEnum
CREATE TYPE "DiscussionSpaceType" AS ENUM ('COURSE');

-- CreateEnum
CREATE TYPE "DiscussionScopeType" AS ENUM ('COURSE', 'PRACTICE_STACK', 'EXTERNAL_BLOCK');

-- CreateEnum
CREATE TYPE "DiscussionEventType" AS ENUM (
  'THREAD_CREATED',
  'THREAD_DELETED',
  'REPLY_CREATED',
  'REPLY_DELETED',
  'THREAD_UPVOTED',
  'REPLY_UPVOTED',
  'ANON_RATE_LIMITED'
);

-- AlterTable
ALTER TABLE "Course"
ADD COLUMN "isCourseQARolloutEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isCourseQAAnonymousEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isCourseQAEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DiscussionSpace" (
  "id" SERIAL NOT NULL,
  "spaceType" "DiscussionSpaceType" NOT NULL,
  "courseId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiscussionSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscussionScope" (
  "id" SERIAL NOT NULL,
  "spaceId" INTEGER NOT NULL,
  "scopeType" "DiscussionScopeType" NOT NULL,
  "scopeKey" TEXT NOT NULL,
  "scopeLabel" TEXT NOT NULL,
  "stackId" INTEGER,
  "externalSource" TEXT,
  "externalRef" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiscussionScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscussionThread" (
  "id" SERIAL NOT NULL,
  "scopeId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
  "authorFingerprintHash" TEXT,
  "authorParticipantId" UUID,
  "upvotes" INTEGER NOT NULL DEFAULT 0,
  "replyCount" INTEGER NOT NULL DEFAULT 0,
  "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiscussionThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscussionReply" (
  "id" SERIAL NOT NULL,
  "threadId" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
  "authorFingerprintHash" TEXT,
  "authorParticipantId" UUID,
  "upvotes" INTEGER NOT NULL DEFAULT 0,
  "isDeleted" BOOLEAN NOT NULL DEFAULT false,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiscussionReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscussionThreadVote" (
  "threadId" INTEGER NOT NULL,
  "participantId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DiscussionThreadVote_pkey" PRIMARY KEY ("threadId", "participantId")
);

-- CreateTable
CREATE TABLE "DiscussionReplyVote" (
  "replyId" INTEGER NOT NULL,
  "participantId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DiscussionReplyVote_pkey" PRIMARY KEY ("replyId", "participantId")
);

-- CreateTable
CREATE TABLE "DiscussionEvent" (
  "id" SERIAL NOT NULL,
  "scopeId" INTEGER NOT NULL,
  "subjectId" INTEGER,
  "participantId" UUID,
  "eventType" "DiscussionEventType" NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DiscussionEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DiscussionEvent_subjectId_check" CHECK (
    (
      "eventType" = 'ANON_RATE_LIMITED'
      AND "subjectId" IS NULL
    )
    OR (
      "eventType" <> 'ANON_RATE_LIMITED'
      AND "subjectId" IS NOT NULL
    )
  )
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionSpace_courseId_key" ON "DiscussionSpace"("courseId");

-- CreateIndex
CREATE INDEX "DiscussionSpace_spaceType_idx" ON "DiscussionSpace"("spaceType");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionScope_spaceId_scopeKey_key" ON "DiscussionScope"("spaceId", "scopeKey");

-- CreateIndex
CREATE INDEX "DiscussionScope_spaceId_scopeType_idx" ON "DiscussionScope"("spaceId", "scopeType");

-- CreateIndex
CREATE INDEX "DiscussionThread_scopeId_lastActivityAt_idx" ON "DiscussionThread"("scopeId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "DiscussionThread_authorParticipantId_idx" ON "DiscussionThread"("authorParticipantId");

-- CreateIndex
CREATE INDEX "DiscussionReply_threadId_createdAt_idx" ON "DiscussionReply"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionReply_authorParticipantId_idx" ON "DiscussionReply"("authorParticipantId");

-- CreateIndex
CREATE INDEX "DiscussionThreadVote_participantId_createdAt_idx" ON "DiscussionThreadVote"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionReplyVote_participantId_createdAt_idx" ON "DiscussionReplyVote"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionEvent_scopeId_createdAt_idx" ON "DiscussionEvent"("scopeId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionEvent_eventType_subjectId_createdAt_idx" ON "DiscussionEvent"("eventType", "subjectId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionEvent_participantId_createdAt_idx" ON "DiscussionEvent"("participantId", "createdAt");

-- AddForeignKey
ALTER TABLE "DiscussionSpace" ADD CONSTRAINT "DiscussionSpace_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionScope" ADD CONSTRAINT "DiscussionScope_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "DiscussionSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "DiscussionScope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionThread" ADD CONSTRAINT "DiscussionThread_authorParticipantId_fkey" FOREIGN KEY ("authorParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionReply" ADD CONSTRAINT "DiscussionReply_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DiscussionThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionReply" ADD CONSTRAINT "DiscussionReply_authorParticipantId_fkey" FOREIGN KEY ("authorParticipantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionThreadVote" ADD CONSTRAINT "DiscussionThreadVote_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "DiscussionThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionThreadVote" ADD CONSTRAINT "DiscussionThreadVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionReplyVote" ADD CONSTRAINT "DiscussionReplyVote_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "DiscussionReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionReplyVote" ADD CONSTRAINT "DiscussionReplyVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionEvent" ADD CONSTRAINT "DiscussionEvent_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "DiscussionScope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscussionEvent" ADD CONSTRAINT "DiscussionEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
