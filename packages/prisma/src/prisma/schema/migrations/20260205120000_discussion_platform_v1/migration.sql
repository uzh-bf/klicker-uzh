-- CreateEnum
CREATE TYPE "public"."DiscussionSpaceType" AS ENUM ('COURSE', 'LIVE_QUIZ');

-- CreateEnum
CREATE TYPE "public"."DiscussionScopeType" AS ENUM ('COURSE', 'PRACTICE_QUIZ', 'PRACTICE_STACK', 'PRACTICE_ELEMENT', 'LIVE_QUIZ', 'LIVE_BLOCK', 'LIVE_INSTANCE', 'EXTERNAL_BLOCK');

-- CreateEnum
CREATE TYPE "public"."DiscussionEventType" AS ENUM ('THREAD_CREATED', 'REPLY_CREATED', 'THREAD_UPVOTED', 'REPLY_UPVOTED', 'ANON_RATE_LIMITED');

-- AlterTable
ALTER TABLE "public"."Course"
ADD COLUMN "isCourseQAAnonymousEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "isCourseQAEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."DiscussionSpace" (
    "id" SERIAL NOT NULL,
    "spaceType" "public"."DiscussionSpaceType" NOT NULL,
    "courseId" UUID,
    "liveQuizId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscussionSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiscussionScope" (
    "id" SERIAL NOT NULL,
    "spaceId" INTEGER NOT NULL,
    "scopeType" "public"."DiscussionScopeType" NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "scopeLabel" TEXT NOT NULL,
    "practiceQuizId" UUID,
    "stackId" INTEGER,
    "instanceId" INTEGER,
    "liveBlockId" INTEGER,
    "externalSource" TEXT,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscussionScope_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DiscussionThread" (
    "id" SERIAL NOT NULL,
    "spaceId" INTEGER NOT NULL,
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
CREATE TABLE "public"."DiscussionReply" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER NOT NULL,
    "spaceId" INTEGER NOT NULL,
    "scopeId" INTEGER NOT NULL,
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
CREATE TABLE "public"."DiscussionThreadVote" (
    "threadId" INTEGER NOT NULL,
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionThreadVote_pkey" PRIMARY KEY ("threadId", "participantId")
);

-- CreateTable
CREATE TABLE "public"."DiscussionReplyVote" (
    "replyId" INTEGER NOT NULL,
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionReplyVote_pkey" PRIMARY KEY ("replyId", "participantId")
);

-- CreateTable
CREATE TABLE "public"."DiscussionEvent" (
    "id" SERIAL NOT NULL,
    "spaceId" INTEGER NOT NULL,
    "scopeId" INTEGER,
    "threadId" INTEGER,
    "replyId" INTEGER,
    "participantId" UUID,
    "eventType" "public"."DiscussionEventType" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscussionEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionSpace_courseId_key" ON "public"."DiscussionSpace"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionSpace_liveQuizId_key" ON "public"."DiscussionSpace"("liveQuizId");

-- CreateIndex
CREATE INDEX "DiscussionSpace_spaceType_idx" ON "public"."DiscussionSpace"("spaceType");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionScope_spaceId_scopeKey_key" ON "public"."DiscussionScope"("spaceId", "scopeKey");

-- CreateIndex
CREATE INDEX "DiscussionScope_spaceId_scopeType_idx" ON "public"."DiscussionScope"("spaceId", "scopeType");

-- CreateIndex
CREATE INDEX "DiscussionThread_spaceId_scopeId_lastActivityAt_idx" ON "public"."DiscussionThread"("spaceId", "scopeId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "DiscussionThread_scopeId_lastActivityAt_idx" ON "public"."DiscussionThread"("scopeId", "lastActivityAt");

-- CreateIndex
CREATE INDEX "DiscussionThread_authorParticipantId_idx" ON "public"."DiscussionThread"("authorParticipantId");

-- CreateIndex
CREATE INDEX "DiscussionReply_threadId_createdAt_idx" ON "public"."DiscussionReply"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionReply_spaceId_scopeId_createdAt_idx" ON "public"."DiscussionReply"("spaceId", "scopeId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionReply_authorParticipantId_idx" ON "public"."DiscussionReply"("authorParticipantId");

-- CreateIndex
CREATE INDEX "DiscussionThreadVote_participantId_createdAt_idx" ON "public"."DiscussionThreadVote"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionReplyVote_participantId_createdAt_idx" ON "public"."DiscussionReplyVote"("participantId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionEvent_spaceId_createdAt_idx" ON "public"."DiscussionEvent"("spaceId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionEvent_scopeId_createdAt_idx" ON "public"."DiscussionEvent"("scopeId", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionEvent_eventType_createdAt_idx" ON "public"."DiscussionEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "DiscussionEvent_participantId_createdAt_idx" ON "public"."DiscussionEvent"("participantId", "createdAt");

-- AddConstraint
ALTER TABLE "public"."DiscussionSpace"
ADD CONSTRAINT "DiscussionSpace_identity_check"
CHECK (
  (
    "spaceType" = 'COURSE'::"public"."DiscussionSpaceType"
    AND "courseId" IS NOT NULL
    AND "liveQuizId" IS NULL
  )
  OR
  (
    "spaceType" = 'LIVE_QUIZ'::"public"."DiscussionSpaceType"
    AND "liveQuizId" IS NOT NULL
    AND "courseId" IS NULL
  )
);

-- AddForeignKey
ALTER TABLE "public"."DiscussionSpace" ADD CONSTRAINT "DiscussionSpace_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "public"."Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionSpace" ADD CONSTRAINT "DiscussionSpace_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "public"."LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionScope" ADD CONSTRAINT "DiscussionScope_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "public"."DiscussionSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionThread" ADD CONSTRAINT "DiscussionThread_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "public"."DiscussionSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionThread" ADD CONSTRAINT "DiscussionThread_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "public"."DiscussionScope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionThread" ADD CONSTRAINT "DiscussionThread_authorParticipantId_fkey" FOREIGN KEY ("authorParticipantId") REFERENCES "public"."Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionReply" ADD CONSTRAINT "DiscussionReply_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."DiscussionThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionReply" ADD CONSTRAINT "DiscussionReply_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "public"."DiscussionSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionReply" ADD CONSTRAINT "DiscussionReply_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "public"."DiscussionScope"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionReply" ADD CONSTRAINT "DiscussionReply_authorParticipantId_fkey" FOREIGN KEY ("authorParticipantId") REFERENCES "public"."Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionThreadVote" ADD CONSTRAINT "DiscussionThreadVote_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."DiscussionThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionThreadVote" ADD CONSTRAINT "DiscussionThreadVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionReplyVote" ADD CONSTRAINT "DiscussionReplyVote_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "public"."DiscussionReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionReplyVote" ADD CONSTRAINT "DiscussionReplyVote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionEvent" ADD CONSTRAINT "DiscussionEvent_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "public"."DiscussionSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionEvent" ADD CONSTRAINT "DiscussionEvent_scopeId_fkey" FOREIGN KEY ("scopeId") REFERENCES "public"."DiscussionScope"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionEvent" ADD CONSTRAINT "DiscussionEvent_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."DiscussionThread"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionEvent" ADD CONSTRAINT "DiscussionEvent_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "public"."DiscussionReply"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DiscussionEvent" ADD CONSTRAINT "DiscussionEvent_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
