-- CreateEnum
CREATE TYPE "FreeTextPracticeCycleStatus" AS ENUM ('ACTIVE', 'CORRECT', 'SOLUTION_REVEALED', 'EXHAUSTED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "FreeTextEvaluationStatus" AS ENUM ('PENDING', 'EVALUATED', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "FreeTextEvaluationSource" AS ENUM ('SEMANTIC', 'EXACT_MATCH');

-- CreateEnum
CREATE TYPE "FreeTextCorrectnessCategory" AS ENUM ('CORRECT', 'PARTIAL', 'INCORRECT');

-- CreateEnum
CREATE TYPE "SemanticEvaluationConsentDecision" AS ENUM ('ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "FreeTextPracticeCycle" (
    "id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "status" "FreeTextPracticeCycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "attemptLimit" INTEGER NOT NULL,
    "stateVersion" INTEGER NOT NULL DEFAULT 1,
    "pointsRewardEligible" BOOLEAN NOT NULL,
    "xpRewardEligible" BOOLEAN NOT NULL,
    "bestScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bestXp" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pointsAwarded" DOUBLE PRECISION DEFAULT 0,
    "xpAwarded" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "solutionRevealedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "participantId" UUID NOT NULL,
    "participationId" INTEGER NOT NULL,
    "elementInstanceId" INTEGER NOT NULL,
    "practiceQuizId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreeTextPracticeCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreeTextAttempt" (
    "id" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "clientSubmissionId" UUID NOT NULL,
    "answer" TEXT NOT NULL,
    "answerTime" REAL NOT NULL,
    "evaluationRevision" INTEGER NOT NULL DEFAULT 0,
    "evaluationStatus" "FreeTextEvaluationStatus" NOT NULL DEFAULT 'PENDING',
    "evaluationSource" "FreeTextEvaluationSource",
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "availabilityReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "rubricSchemaVersion" TEXT NOT NULL,
    "rubricSchemaHash" TEXT NOT NULL,
    "evaluatorVersion" TEXT,
    "modelVersion" TEXT,
    "aggregateScore" DOUBLE PRECISION,
    "outcomeBandId" TEXT,
    "outcomeBandLabel" TEXT,
    "correctness" "FreeTextCorrectnessCategory",
    "structuredResult" JSONB,
    "workflowRunId" TEXT,
    "cycleId" UUID NOT NULL,
    "questionResponseDetailId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FreeTextAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreeTextConsentEvent" (
    "id" SERIAL NOT NULL,
    "disclosureVersion" TEXT NOT NULL,
    "decision" "SemanticEvaluationConsentDecision" NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "participantId" UUID NOT NULL,

    CONSTRAINT "FreeTextConsentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FreeTextConsentEvent_participantId_disclosu_idx" ON "FreeTextConsentEvent"("participantId", "disclosureVersion", "decidedAt");

-- CreateIndex
CREATE INDEX "FreeTextPracticeCycle_participantId_practiceQuizId_idx" ON "FreeTextPracticeCycle"("participantId", "practiceQuizId");

-- CreateIndex
CREATE INDEX "FreeTextPracticeCycle_practiceQuizId_elementInstanceId_idx" ON "FreeTextPracticeCycle"("practiceQuizId", "elementInstanceId");

-- CreateIndex
CREATE INDEX "FreeTextPracticeCycle_elementInstanceId_status_idx" ON "FreeTextPracticeCycle"("elementInstanceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FreeTextPracticeCycle_participantId_elementInstanceId_ordin_key" ON "FreeTextPracticeCycle"("participantId", "elementInstanceId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "FreeTextAttempt_questionResponseDetailId_key" ON "FreeTextAttempt"("questionResponseDetailId");

-- CreateIndex
CREATE INDEX "FreeTextAttempt_evaluationStatus_updatedAt_idx" ON "FreeTextAttempt"("evaluationStatus", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FreeTextAttempt_cycleId_ordinal_key" ON "FreeTextAttempt"("cycleId", "ordinal");

-- CreateIndex
CREATE UNIQUE INDEX "FreeTextAttempt_cycleId_clientSubmissionId_key" ON "FreeTextAttempt"("cycleId", "clientSubmissionId");

-- AddForeignKey
ALTER TABLE "FreeTextPracticeCycle" ADD CONSTRAINT "FreeTextPracticeCycle_participationId_participantId_fkey" FOREIGN KEY ("participationId", "participantId") REFERENCES "Participation"("id", "participantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeTextPracticeCycle" ADD CONSTRAINT "FreeTextPracticeCycle_elementInstanceId_fkey" FOREIGN KEY ("elementInstanceId") REFERENCES "ElementInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeTextPracticeCycle" ADD CONSTRAINT "FreeTextPracticeCycle_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeTextAttempt" ADD CONSTRAINT "FreeTextAttempt_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "FreeTextPracticeCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FreeTextAttempt" ADD CONSTRAINT "FreeTextAttempt_questionResponseDetailId_fkey" FOREIGN KEY ("questionResponseDetailId") REFERENCES "QuestionResponseDetail"("id") ON DELETE SET NULL ON UPDATE CASCADE;
