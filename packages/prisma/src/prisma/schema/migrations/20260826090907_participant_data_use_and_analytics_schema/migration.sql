-- CreateEnum
CREATE TYPE "ChatDoseBucket" AS ENUM ('NONE', 'LOW', 'MED', 'HIGH');

-- AlterTable
ALTER TABLE "ActivityPerformance" ADD COLUMN     "participantCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "AggregatedCourseAnalytics" ADD COLUMN     "bothChatAndQuizCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chatParticipantCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "chatbotCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "liveQuizCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "microLearningCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "practiceQuizCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "quizParticipantCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "analyticsFinalizedAt" TIMESTAMP(3),
ADD COLUMN     "analyticsLastComputedAt" TIMESTAMP(3),
ADD COLUMN     "chatAnalyticsValidAt" TIMESTAMP(3),
ADD COLUMN     "isLearningAnalyticsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Participant" ADD COLUMN     "learningAnalyticsChoiceAt" TIMESTAMP(3),
ADD COLUMN     "learningAnalyticsConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "learningAnalyticsDisclosureVersion" TEXT,
ADD COLUMN     "learningAnalyticsIncludedFrom" TIMESTAMP(3),
ADD COLUMN     "researchConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "researchConsentChoiceAt" TIMESTAMP(3),
ADD COLUMN     "researchConsentDisclosureVersion" TEXT;

-- AlterTable
ALTER TABLE "ParticipantCourseAnalytics" ADD COLUMN     "hasChatActivity" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ParticipantChatAnalytics" (
    "id" SERIAL NOT NULL,
    "type" "AnalyticsType" NOT NULL,
    "timestamp" DATE NOT NULL,
    "participantId" UUID NOT NULL,
    "chatbotId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "userMessages" INTEGER NOT NULL DEFAULT 0,
    "assistantMessages" INTEGER NOT NULL DEFAULT 0,
    "threads" INTEGER NOT NULL DEFAULT 0,
    "distinctDays" INTEGER NOT NULL DEFAULT 0,
    "firstMessageAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "msgLenMedian" REAL,
    "msgLenP90" REAL,
    "msgLenP99" REAL,
    "messagesPerThreadP50" REAL,
    "messagesPerThreadP90" REAL,
    "chatModeCounts" JSONB NOT NULL DEFAULT '{}',
    "reasoningEffortCounts" JSONB NOT NULL DEFAULT '{}',
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "totalCreditsUsed" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "creditsExhausted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantChatAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggregatedChatbotAnalytics" (
    "id" SERIAL NOT NULL,
    "type" "AnalyticsType" NOT NULL,
    "timestamp" DATE NOT NULL,
    "chatbotId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "activeParticipants" INTEGER NOT NULL DEFAULT 0,
    "newParticipants" INTEGER NOT NULL DEFAULT 0,
    "returningParticipants" INTEGER NOT NULL DEFAULT 0,
    "threads" INTEGER NOT NULL DEFAULT 0,
    "userMessages" INTEGER NOT NULL DEFAULT 0,
    "assistantMessages" INTEGER NOT NULL DEFAULT 0,
    "totalCreditsUsed" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "creditExhaustionRate" REAL,
    "disclaimerAcceptedCount" INTEGER NOT NULL DEFAULT 0,
    "disclaimerDeclinedCount" INTEGER NOT NULL DEFAULT 0,
    "hourOfDayDistribution" JSONB NOT NULL DEFAULT '{}',
    "modelDistribution" JSONB NOT NULL DEFAULT '{}',
    "modeDistribution" JSONB NOT NULL DEFAULT '{}',
    "reasoningEffortDistribution" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggregatedChatbotAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatTopicCluster" (
    "id" SERIAL NOT NULL,
    "type" "AnalyticsType" NOT NULL,
    "timestamp" DATE NOT NULL,
    "chatbotId" UUID NOT NULL,
    "clusterIndex" INTEGER NOT NULL,
    "clusterLabel" TEXT NOT NULL,
    "messageCount" INTEGER NOT NULL,
    "participantCount" INTEGER NOT NULL,
    "representativeParaphrase" TEXT,
    "embeddingCentroid" BYTEA,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatTopicCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantChatOutcome" (
    "id" SERIAL NOT NULL,
    "participantId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "chatMessagesInCourse" INTEGER NOT NULL DEFAULT 0,
    "chatDoseBucket" "ChatDoseBucket" NOT NULL,
    "firstErrorRate" REAL,
    "lastErrorRate" REAL,
    "errorRateDelta" REAL,
    "hasBothModalities" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantChatOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParticipantLiveQuizAnalytics" (
    "id" SERIAL NOT NULL,
    "participantId" UUID NOT NULL,
    "liveQuizId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "totalResponses" INTEGER NOT NULL DEFAULT 0,
    "firstCorrectCount" INTEGER NOT NULL DEFAULT 0,
    "lastCorrectCount" INTEGER NOT NULL DEFAULT 0,
    "averageTimeSpent" REAL,
    "totalBasePoints" INTEGER NOT NULL DEFAULT 0,
    "totalCorrectnessPoints" INTEGER NOT NULL DEFAULT 0,
    "totalBonusPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParticipantLiveQuizAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AggregatedLiveQuizAnalytics" (
    "id" SERIAL NOT NULL,
    "liveQuizId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "meanFirstCorrectness" REAL,
    "meanLastCorrectness" REAL,
    "lateSubmitterRate" REAL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AggregatedLiveQuizAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSemesterAnalytics" (
    "id" SERIAL NOT NULL,
    "semesterLabel" TEXT NOT NULL,
    "semesterStart" TIMESTAMP(3) NOT NULL,
    "semesterEnd" TIMESTAMP(3) NOT NULL,
    "quizResponseRows" INTEGER NOT NULL DEFAULT 0,
    "quizTrials" INTEGER NOT NULL DEFAULT 0,
    "quizDistinctParticipants" INTEGER NOT NULL DEFAULT 0,
    "liveQuizResponses" INTEGER NOT NULL DEFAULT 0,
    "liveQuizDistinctParticipants" INTEGER NOT NULL DEFAULT 0,
    "chatMessages" INTEGER NOT NULL DEFAULT 0,
    "chatDistinctParticipants" INTEGER NOT NULL DEFAULT 0,
    "activeCourses" INTEGER NOT NULL DEFAULT 0,
    "coursesWithChatbot" INTEGER NOT NULL DEFAULT 0,
    "coursesWithLiveQuiz" INTEGER NOT NULL DEFAULT 0,
    "coursesWithQuizActivity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSemesterAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParticipantChatAnalytics_chatbotId_type_timestamp_idx" ON "ParticipantChatAnalytics"("chatbotId", "type", "timestamp");

-- CreateIndex
CREATE INDEX "ParticipantChatAnalytics_courseId_type_timestamp_idx" ON "ParticipantChatAnalytics"("courseId", "type", "timestamp");

-- CreateIndex
CREATE INDEX "ParticipantChatAnalytics_courseId_participantId_idx" ON "ParticipantChatAnalytics"("courseId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantChatAnalytics_type_participantId_chatbotId_times_key" ON "ParticipantChatAnalytics"("type", "participantId", "chatbotId", "timestamp");

-- CreateIndex
CREATE INDEX "AggregatedChatbotAnalytics_courseId_type_timestamp_idx" ON "AggregatedChatbotAnalytics"("courseId", "type", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "AggregatedChatbotAnalytics_type_chatbotId_timestamp_key" ON "AggregatedChatbotAnalytics"("type", "chatbotId", "timestamp");

-- CreateIndex
CREATE INDEX "ChatTopicCluster_chatbotId_timestamp_idx" ON "ChatTopicCluster"("chatbotId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ChatTopicCluster_type_chatbotId_timestamp_clusterIndex_key" ON "ChatTopicCluster"("type", "chatbotId", "timestamp", "clusterIndex");

-- CreateIndex
CREATE INDEX "ParticipantChatOutcome_courseId_chatDoseBucket_idx" ON "ParticipantChatOutcome"("courseId", "chatDoseBucket");

-- CreateIndex
CREATE INDEX "ParticipantChatOutcome_courseId_participantId_idx" ON "ParticipantChatOutcome"("courseId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantChatOutcome_participantId_courseId_key" ON "ParticipantChatOutcome"("participantId", "courseId");

-- CreateIndex
CREATE INDEX "ParticipantLiveQuizAnalytics_courseId_idx" ON "ParticipantLiveQuizAnalytics"("courseId");

-- CreateIndex
CREATE INDEX "ParticipantLiveQuizAnalytics_liveQuizId_idx" ON "ParticipantLiveQuizAnalytics"("liveQuizId");

-- CreateIndex
CREATE INDEX "ParticipantLiveQuizAnalytics_courseId_participantId_idx" ON "ParticipantLiveQuizAnalytics"("courseId", "participantId");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantLiveQuizAnalytics_participantId_liveQuizId_key" ON "ParticipantLiveQuizAnalytics"("participantId", "liveQuizId");

-- CreateIndex
CREATE UNIQUE INDEX "AggregatedLiveQuizAnalytics_liveQuizId_key" ON "AggregatedLiveQuizAnalytics"("liveQuizId");

-- CreateIndex
CREATE INDEX "AggregatedLiveQuizAnalytics_courseId_idx" ON "AggregatedLiveQuizAnalytics"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformSemesterAnalytics_semesterLabel_key" ON "PlatformSemesterAnalytics"("semesterLabel");

-- CreateIndex
CREATE INDEX "AggregatedAnalytics_courseId_type_timestamp_idx" ON "AggregatedAnalytics"("courseId", "type", "timestamp");

-- CreateIndex
CREATE INDEX "ChatMessage_createdAt_idx" ON "ChatMessage"("createdAt");

-- CreateIndex
CREATE INDEX "ChatMessage_threadId_createdAt_idx" ON "ChatMessage"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "Course_isLearningAnalyticsEnabled_id_idx" ON "Course"("isLearningAnalyticsEnabled", "id");

-- CreateIndex
CREATE INDEX "LiveQuizResponse_instanceId_participantId_submittedAt_idx" ON "LiveQuizResponse"("instanceId", "participantId", "submittedAt");

-- CreateIndex
CREATE INDEX "Participant_researchConsent_id_idx" ON "Participant"("researchConsent", "id");

-- CreateIndex
CREATE INDEX "Participant_learningAnalyticsConsent_learningAnalyticsInclu_idx" ON "Participant"("learningAnalyticsConsent", "learningAnalyticsIncludedFrom", "id");

-- CreateIndex
CREATE INDEX "ParticipantActivityPerformance_practiceQuizId_participantId_idx" ON "ParticipantActivityPerformance"("practiceQuizId", "participantId");

-- CreateIndex
CREATE INDEX "ParticipantActivityPerformance_microLearningId_participantI_idx" ON "ParticipantActivityPerformance"("microLearningId", "participantId");

-- CreateIndex
CREATE INDEX "ParticipantAnalytics_courseId_type_timestamp_idx" ON "ParticipantAnalytics"("courseId", "type", "timestamp");

-- CreateIndex
CREATE INDEX "ParticipantAnalytics_courseId_participantId_idx" ON "ParticipantAnalytics"("courseId", "participantId");

-- CreateIndex
CREATE INDEX "ParticipantPerformance_courseId_participantId_idx" ON "ParticipantPerformance"("courseId", "participantId");

-- CreateIndex
CREATE INDEX "QuestionResponse_courseId_createdAt_idx" ON "QuestionResponse"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionResponseDetail_createdAt_brin_idx" ON "QuestionResponseDetail" USING BRIN ("createdAt");

-- CreateIndex
CREATE INDEX "LiveQuizResponse_createdAt_brin_idx" ON "LiveQuizResponse" USING BRIN ("createdAt");

-- AddForeignKey
ALTER TABLE "ParticipantChatAnalytics" ADD CONSTRAINT "ParticipantChatAnalytics_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantChatAnalytics" ADD CONSTRAINT "ParticipantChatAnalytics_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantChatAnalytics" ADD CONSTRAINT "ParticipantChatAnalytics_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregatedChatbotAnalytics" ADD CONSTRAINT "AggregatedChatbotAnalytics_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregatedChatbotAnalytics" ADD CONSTRAINT "AggregatedChatbotAnalytics_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatTopicCluster" ADD CONSTRAINT "ChatTopicCluster_chatbotId_fkey" FOREIGN KEY ("chatbotId") REFERENCES "Chatbot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantChatOutcome" ADD CONSTRAINT "ParticipantChatOutcome_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantChatOutcome" ADD CONSTRAINT "ParticipantChatOutcome_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantLiveQuizAnalytics" ADD CONSTRAINT "ParticipantLiveQuizAnalytics_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantLiveQuizAnalytics" ADD CONSTRAINT "ParticipantLiveQuizAnalytics_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantLiveQuizAnalytics" ADD CONSTRAINT "ParticipantLiveQuizAnalytics_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregatedLiveQuizAnalytics" ADD CONSTRAINT "AggregatedLiveQuizAnalytics_liveQuizId_fkey" FOREIGN KEY ("liveQuizId") REFERENCES "LiveQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AggregatedLiveQuizAnalytics" ADD CONSTRAINT "AggregatedLiveQuizAnalytics_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
