-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PARTICIPANT', 'USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "SSOType" AS ENUM ('Shibboleth', 'LTI');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('PNG', 'JPEG', 'SVG', 'WEBP', 'GIF', 'LINK');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SC', 'MC', 'KPRIM', 'FREE_TEXT', 'NUMERICAL');

-- CreateEnum
CREATE TYPE "QuestionInstanceType" AS ENUM ('UNSET', 'SESSION', 'MICRO_SESSION', 'LEARNING_ELEMENT');

-- CreateEnum
CREATE TYPE "LeaderboardType" AS ENUM ('SESSION_BLOCK', 'SESSION', 'COURSE');

-- CreateEnum
CREATE TYPE "SessionBlockStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'EXECUTED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('PREPARED', 'SCHEDULED', 'RUNNING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AccessMode" AS ENUM ('PUBLIC', 'RESTRICTED');

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "ssoType" "SSOType" NOT NULL,
    "ssoId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isAAI" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT NOT NULL,
    "shortname" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "description" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "deletionToken" TEXT,
    "deletionRequestedAt" TIMESTAMP(3),
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" UUID NOT NULL,
    "href" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT,
    "description" TEXT,
    "type" "AttachmentType" NOT NULL,
    "questionId" INTEGER,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttachmentInstance" (
    "id" UUID NOT NULL,
    "href" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalName" TEXT,
    "description" TEXT,
    "type" "AttachmentType" NOT NULL,
    "questionInstanceId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttachmentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" SERIAL NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentPlain" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "type" "QuestionType" NOT NULL,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" SERIAL NOT NULL,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionInstance" (
    "id" SERIAL NOT NULL,
    "type" "QuestionInstanceType",
    "order" INTEGER,
    "questionData" JSONB NOT NULL,
    "participants" INTEGER NOT NULL DEFAULT 0,
    "results" JSONB NOT NULL,
    "sessionBlockId" INTEGER,
    "learningElementId" UUID,
    "microSessionId" UUID,
    "questionId" INTEGER,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" UUID NOT NULL,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "pinCode" INTEGER NOT NULL DEFAULT 1800,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "id" SERIAL NOT NULL,
    "type" "LeaderboardType" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "participantId" UUID NOT NULL,
    "sessionParticipationId" INTEGER,
    "sessionBlockId" INTEGER,
    "sessionId" UUID,
    "courseId" UUID,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionBlock" (
    "id" SERIAL NOT NULL,
    "order" INTEGER,
    "status" "SessionBlockStatus" NOT NULL DEFAULT 'SCHEDULED',
    "expiresAt" TIMESTAMP(3),
    "timeLimit" INTEGER,
    "randomSelection" INTEGER,
    "execution" INTEGER NOT NULL DEFAULT 0,
    "sessionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "isAudienceInteractionActive" BOOLEAN NOT NULL DEFAULT false,
    "isLiveQAEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isConfusionFeedbackEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isModerationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "isGamificationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "namespace" UUID NOT NULL,
    "pinCode" INTEGER,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "linkTo" TEXT,
    "accessMode" "AccessMode" NOT NULL DEFAULT 'PUBLIC',
    "status" "SessionStatus" NOT NULL DEFAULT 'PREPARED',
    "activeBlockId" INTEGER,
    "ownerId" UUID NOT NULL,
    "courseId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningElement" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MicroSession" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "scheduledStartAt" TIMESTAMP(3) NOT NULL,
    "scheduledEndAt" TIMESTAMP(3) NOT NULL,
    "ownerId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MicroSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" SERIAL NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "votes" INTEGER NOT NULL DEFAULT 0,
    "resolvedAt" TIMESTAMP(3),
    "sessionId" UUID NOT NULL,
    "participantId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackResponse" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "positiveReactions" INTEGER NOT NULL DEFAULT 0,
    "negativeReactions" INTEGER NOT NULL DEFAULT 0,
    "feedbackId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfusionTimestep" (
    "id" SERIAL NOT NULL,
    "difficulty" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "sessionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfusionTimestep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantAccount" (
    "id" UUID NOT NULL,
    "ssoType" "SSOType" NOT NULL,
    "ssoId" TEXT NOT NULL,
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParticipantAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participant" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "avatar" TEXT,
    "avatarSettings" JSONB,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Participation" (
    "id" SERIAL NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "courseId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "courseLeaderboardId" INTEGER,
    "completedMicroSessions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionResponse" (
    "id" SERIAL NOT NULL,
    "trialsCount" INTEGER NOT NULL DEFAULT 0,
    "totalScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPointsAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastAwardedAt" TIMESTAMP(3),
    "response" JSONB NOT NULL,
    "participantId" UUID NOT NULL,
    "participationId" INTEGER NOT NULL,
    "questionInstanceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT NOT NULL,
    "expirationTime" INTEGER,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "courseId" UUID NOT NULL,
    "participationId" INTEGER NOT NULL,
    "participantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_QuestionToTag" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateTable
CREATE TABLE "_ParticipantFollows" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_shortname_key" ON "User"("shortname");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_href_key" ON "Attachment"("href");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionInstance_type_sessionBlockId_order_key" ON "QuestionInstance"("type", "sessionBlockId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionInstance_type_learningElementId_order_key" ON "QuestionInstance"("type", "learningElementId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionInstance_type_microSessionId_order_key" ON "QuestionInstance"("type", "microSessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_type_participantId_sessionBlockId_key" ON "LeaderboardEntry"("type", "participantId", "sessionBlockId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_type_participantId_sessionId_key" ON "LeaderboardEntry"("type", "participantId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardEntry_type_participantId_courseId_key" ON "LeaderboardEntry"("type", "participantId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionBlock_sessionId_order_key" ON "SessionBlock"("sessionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantAccount_ssoType_ssoId_key" ON "ParticipantAccount"("ssoType", "ssoId");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_username_key" ON "Participant"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Participation_courseLeaderboardId_key" ON "Participation"("courseLeaderboardId");

-- CreateIndex
CREATE UNIQUE INDEX "Participation_courseId_participantId_key" ON "Participation"("courseId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionResponse_participantId_questionInstanceId_key" ON "QuestionResponse"("participantId", "questionInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_participantId_courseId_endpoint_key" ON "PushSubscription"("participantId", "courseId", "endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "_QuestionToTag_AB_unique" ON "_QuestionToTag"("A", "B");

-- CreateIndex
CREATE INDEX "_QuestionToTag_B_index" ON "_QuestionToTag"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_ParticipantFollows_AB_unique" ON "_ParticipantFollows"("A", "B");

-- CreateIndex
CREATE INDEX "_ParticipantFollows_B_index" ON "_ParticipantFollows"("B");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttachmentInstance" ADD CONSTRAINT "AttachmentInstance_questionInstanceId_fkey" FOREIGN KEY ("questionInstanceId") REFERENCES "QuestionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tag" ADD CONSTRAINT "Tag_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionInstance" ADD CONSTRAINT "QuestionInstance_sessionBlockId_fkey" FOREIGN KEY ("sessionBlockId") REFERENCES "SessionBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionInstance" ADD CONSTRAINT "QuestionInstance_learningElementId_fkey" FOREIGN KEY ("learningElementId") REFERENCES "LearningElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionInstance" ADD CONSTRAINT "QuestionInstance_microSessionId_fkey" FOREIGN KEY ("microSessionId") REFERENCES "MicroSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionInstance" ADD CONSTRAINT "QuestionInstance_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionInstance" ADD CONSTRAINT "QuestionInstance_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_sessionParticipationId_fkey" FOREIGN KEY ("sessionParticipationId") REFERENCES "Participation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_sessionBlockId_fkey" FOREIGN KEY ("sessionBlockId") REFERENCES "SessionBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBlock" ADD CONSTRAINT "SessionBlock_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_activeBlockId_fkey" FOREIGN KEY ("activeBlockId") REFERENCES "SessionBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningElement" ADD CONSTRAINT "LearningElement_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningElement" ADD CONSTRAINT "LearningElement_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicroSession" ADD CONSTRAINT "MicroSession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MicroSession" ADD CONSTRAINT "MicroSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackResponse" ADD CONSTRAINT "FeedbackResponse_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "Feedback"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfusionTimestep" ADD CONSTRAINT "ConfusionTimestep_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantAccount" ADD CONSTRAINT "ParticipantAccount_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_courseLeaderboardId_fkey" FOREIGN KEY ("courseLeaderboardId") REFERENCES "LeaderboardEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionResponse" ADD CONSTRAINT "QuestionResponse_questionInstanceId_fkey" FOREIGN KEY ("questionInstanceId") REFERENCES "QuestionInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestionToTag" ADD CONSTRAINT "_QuestionToTag_A_fkey" FOREIGN KEY ("A") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_QuestionToTag" ADD CONSTRAINT "_QuestionToTag_B_fkey" FOREIGN KEY ("B") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipantFollows" ADD CONSTRAINT "_ParticipantFollows_A_fkey" FOREIGN KEY ("A") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ParticipantFollows" ADD CONSTRAINT "_ParticipantFollows_B_fkey" FOREIGN KEY ("B") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
