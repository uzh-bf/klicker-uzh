-- CreateEnum
CREATE TYPE "AdaptiveAssessmentAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "AdaptiveAssessment" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "thetaMin" DOUBLE PRECISION NOT NULL DEFAULT -3,
    "thetaMax" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "discrimination" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "standardErrorThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.4,
    "questionThreshold" INTEGER NOT NULL DEFAULT 50,
    "topInformationRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "showTimer" BOOLEAN NOT NULL DEFAULT true,
    "showCompetenceNames" BOOLEAN NOT NULL DEFAULT true,
    "showFinalResult" BOOLEAN NOT NULL DEFAULT true,
    "courseId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptiveAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveAssessmentLevel" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "assessmentId" UUID NOT NULL,

    CONSTRAINT "AdaptiveAssessmentLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveAssessmentCompetence" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tagName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "assessmentId" UUID NOT NULL,

    CONSTRAINT "AdaptiveAssessmentCompetence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveAssessmentSubCompetence" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tagName" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL,
    "questionThreshold" INTEGER,
    "standardErrorThreshold" DOUBLE PRECISION,
    "assessmentId" UUID NOT NULL,
    "competenceId" INTEGER NOT NULL,

    CONSTRAINT "AdaptiveAssessmentSubCompetence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveAssessmentElement" (
    "id" SERIAL NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "exposure" INTEGER NOT NULL DEFAULT 0,
    "discrimination" DOUBLE PRECISION,
    "assessmentId" UUID NOT NULL,
    "elementId" INTEGER NOT NULL,
    "competenceId" INTEGER NOT NULL,
    "subCompetenceId" INTEGER NOT NULL,
    "levelId" INTEGER NOT NULL,

    CONSTRAINT "AdaptiveAssessmentElement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveAssessmentAttempt" (
    "id" UUID NOT NULL,
    "status" "AdaptiveAssessmentAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentTheta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentStandardError" DOUBLE PRECISION,
    "finalTheta" DOUBLE PRECISION,
    "finalStandardError" DOUBLE PRECISION,
    "finalLevelLabel" TEXT,
    "elapsedSeconds" INTEGER,
    "thetaHistory" JSONB,
    "standardErrorHistory" JSONB,
    "assessmentId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "participationId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptiveAssessmentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveAssessmentResponse" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "thetaBefore" DOUBLE PRECISION NOT NULL,
    "thetaAfter" DOUBLE PRECISION NOT NULL,
    "standardErrorAfter" DOUBLE PRECISION NOT NULL,
    "elapsedSeconds" INTEGER,
    "attemptId" UUID NOT NULL,
    "adaptiveElementId" INTEGER NOT NULL,
    "elementId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptiveAssessmentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptiveAssessmentResultMessage" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "minTheta" DOUBLE PRECISION,
    "maxTheta" DOUBLE PRECISION,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "assessmentId" UUID NOT NULL,
    "levelId" INTEGER,

    CONSTRAINT "AdaptiveAssessmentResultMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdaptiveAssessment_courseId_idx" ON "AdaptiveAssessment"("courseId");
CREATE INDEX "AdaptiveAssessment_ownerId_idx" ON "AdaptiveAssessment"("ownerId");
CREATE INDEX "AdaptiveAssessment_status_idx" ON "AdaptiveAssessment"("status");
CREATE UNIQUE INDEX "AdaptiveAssessmentLevel_assessmentId_label_key" ON "AdaptiveAssessmentLevel"("assessmentId", "label");
CREATE UNIQUE INDEX "AdaptiveAssessmentLevel_assessmentId_order_key" ON "AdaptiveAssessmentLevel"("assessmentId", "order");
CREATE UNIQUE INDEX "AdaptiveAssessmentCompetence_assessmentId_name_key" ON "AdaptiveAssessmentCompetence"("assessmentId", "name");
CREATE UNIQUE INDEX "AdaptiveAssessmentCompetence_assessmentId_order_key" ON "AdaptiveAssessmentCompetence"("assessmentId", "order");
CREATE UNIQUE INDEX "AdaptiveAssessmentSubCompetence_assessmentId_competenceId_name_key" ON "AdaptiveAssessmentSubCompetence"("assessmentId", "competenceId", "name");
CREATE UNIQUE INDEX "AdaptiveAssessmentSubCompetence_assessmentId_competenceId_order_key" ON "AdaptiveAssessmentSubCompetence"("assessmentId", "competenceId", "order");
CREATE UNIQUE INDEX "AdaptiveAssessmentElement_assessmentId_elementId_competenceId_subCompetenceId_levelId_key" ON "AdaptiveAssessmentElement"("assessmentId", "elementId", "competenceId", "subCompetenceId", "levelId");
CREATE INDEX "AdaptiveAssessmentElement_elementId_idx" ON "AdaptiveAssessmentElement"("elementId");
CREATE INDEX "AdaptiveAssessmentElement_assessmentId_enabled_idx" ON "AdaptiveAssessmentElement"("assessmentId", "enabled");
CREATE INDEX "AdaptiveAssessmentAttempt_assessmentId_participantId_status_idx" ON "AdaptiveAssessmentAttempt"("assessmentId", "participantId", "status");
CREATE INDEX "AdaptiveAssessmentAttempt_participationId_idx" ON "AdaptiveAssessmentAttempt"("participationId");
CREATE UNIQUE INDEX "AdaptiveAssessmentResponse_attemptId_order_key" ON "AdaptiveAssessmentResponse"("attemptId", "order");
CREATE INDEX "AdaptiveAssessmentResponse_attemptId_idx" ON "AdaptiveAssessmentResponse"("attemptId");
CREATE INDEX "AdaptiveAssessmentResponse_adaptiveElementId_idx" ON "AdaptiveAssessmentResponse"("adaptiveElementId");
CREATE INDEX "AdaptiveAssessmentResponse_elementId_idx" ON "AdaptiveAssessmentResponse"("elementId");
CREATE UNIQUE INDEX "AdaptiveAssessmentResultMessage_assessmentId_order_key" ON "AdaptiveAssessmentResultMessage"("assessmentId", "order");
CREATE INDEX "AdaptiveAssessmentResultMessage_assessmentId_isFallback_idx" ON "AdaptiveAssessmentResultMessage"("assessmentId", "isFallback");

-- AddForeignKey
ALTER TABLE "AdaptiveAssessment" ADD CONSTRAINT "AdaptiveAssessment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessment" ADD CONSTRAINT "AdaptiveAssessment_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentLevel" ADD CONSTRAINT "AdaptiveAssessmentLevel_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "AdaptiveAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentCompetence" ADD CONSTRAINT "AdaptiveAssessmentCompetence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "AdaptiveAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentSubCompetence" ADD CONSTRAINT "AdaptiveAssessmentSubCompetence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "AdaptiveAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentSubCompetence" ADD CONSTRAINT "AdaptiveAssessmentSubCompetence_competenceId_fkey" FOREIGN KEY ("competenceId") REFERENCES "AdaptiveAssessmentCompetence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentElement" ADD CONSTRAINT "AdaptiveAssessmentElement_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "AdaptiveAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentElement" ADD CONSTRAINT "AdaptiveAssessmentElement_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentElement" ADD CONSTRAINT "AdaptiveAssessmentElement_competenceId_fkey" FOREIGN KEY ("competenceId") REFERENCES "AdaptiveAssessmentCompetence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentElement" ADD CONSTRAINT "AdaptiveAssessmentElement_subCompetenceId_fkey" FOREIGN KEY ("subCompetenceId") REFERENCES "AdaptiveAssessmentSubCompetence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentElement" ADD CONSTRAINT "AdaptiveAssessmentElement_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "AdaptiveAssessmentLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentAttempt" ADD CONSTRAINT "AdaptiveAssessmentAttempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "AdaptiveAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentAttempt" ADD CONSTRAINT "AdaptiveAssessmentAttempt_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentAttempt" ADD CONSTRAINT "AdaptiveAssessmentAttempt_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentResponse" ADD CONSTRAINT "AdaptiveAssessmentResponse_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AdaptiveAssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentResponse" ADD CONSTRAINT "AdaptiveAssessmentResponse_adaptiveElementId_fkey" FOREIGN KEY ("adaptiveElementId") REFERENCES "AdaptiveAssessmentElement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentResponse" ADD CONSTRAINT "AdaptiveAssessmentResponse_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentResultMessage" ADD CONSTRAINT "AdaptiveAssessmentResultMessage_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "AdaptiveAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptiveAssessmentResultMessage" ADD CONSTRAINT "AdaptiveAssessmentResultMessage_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "AdaptiveAssessmentLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
