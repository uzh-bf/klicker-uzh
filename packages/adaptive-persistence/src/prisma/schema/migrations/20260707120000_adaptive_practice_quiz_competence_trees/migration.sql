-- CreateEnum
CREATE TYPE "PracticeQuizMode" AS ENUM ('STANDARD', 'ADAPTIVE');
CREATE TYPE "AdaptiveLevelMappingRule" AS ENUM ('NEAREST', 'MASTERY');
CREATE TYPE "AdaptiveNodeKind" AS ENUM ('COMPETENCE', 'SUBCOMPETENCE');
CREATE TYPE "AdaptiveEstimateNodeKind" AS ENUM ('OVERALL', 'COMPETENCE', 'SUBCOMPETENCE');
CREATE TYPE "AdaptivePracticeQuizAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- AlterTable
ALTER TABLE "PracticeQuiz" ADD COLUMN "mode" "PracticeQuizMode" NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "CompetenceTree" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "maxDepth" INTEGER NOT NULL DEFAULT 5,
    "thetaMin" DOUBLE PRECISION NOT NULL DEFAULT -3,
    "thetaMax" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "defaultDiscrimination" DOUBLE PRECISION NOT NULL DEFAULT 1.2,
    "levelMappingRule" "AdaptiveLevelMappingRule" NOT NULL DEFAULT 'NEAREST',
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetenceTree_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetenceTreeCourse" (
    "id" SERIAL NOT NULL,
    "treeId" UUID NOT NULL,
    "courseId" UUID NOT NULL,
    "linkedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetenceTreeCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetenceTreeLevel" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "treeId" UUID NOT NULL,

    CONSTRAINT "CompetenceTreeLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetenceTreeNode" (
    "id" SERIAL NOT NULL,
    "kind" "AdaptiveNodeKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "depth" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "treeId" UUID NOT NULL,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetenceTreeNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetenceTreeLeafLevelCoverage" (
    "id" SERIAL NOT NULL,
    "targetItemCount" INTEGER NOT NULL DEFAULT 5,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "treeId" UUID NOT NULL,
    "leafNodeId" INTEGER NOT NULL,
    "levelId" INTEGER NOT NULL,

    CONSTRAINT "CompetenceTreeLeafLevelCoverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetenceTreeElementAssignment" (
    "id" SERIAL NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "discrimination" DOUBLE PRECISION,
    "enablePercentInput" BOOLEAN NOT NULL DEFAULT false,
    "treeId" UUID NOT NULL,
    "elementId" INTEGER NOT NULL,
    "leafNodeId" INTEGER NOT NULL,
    "levelId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompetenceTreeElementAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeQuizAdaptiveConfig" (
    "id" UUID NOT NULL,
    "practiceQuizId" UUID NOT NULL,
    "competenceTreeId" UUID NOT NULL,
    "totalQuestionCap" INTEGER NOT NULL DEFAULT 50,
    "perLeafQuestionCap" INTEGER,
    "minQuestionsPerLeaf" INTEGER NOT NULL DEFAULT 2,
    "classificationZ" DOUBLE PRECISION NOT NULL DEFAULT 1.28,
    "standardErrorThreshold" DOUBLE PRECISION,
    "topInformationRatio" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "defaultDiscrimination" DOUBLE PRECISION NOT NULL DEFAULT 1.2,
    "levelMappingRule" "AdaptiveLevelMappingRule" NOT NULL DEFAULT 'NEAREST',
    "showTimer" BOOLEAN NOT NULL DEFAULT true,
    "showFinalResult" BOOLEAN NOT NULL DEFAULT true,
    "showLiveEstimate" BOOLEAN NOT NULL DEFAULT false,
    "enableSelfAssessmentWarmup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeQuizAdaptiveConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeQuizAdaptiveNodeOverride" (
    "id" SERIAL NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "weight" DOUBLE PRECISION,
    "questionCap" INTEGER,
    "configId" UUID NOT NULL,
    "nodeId" INTEGER NOT NULL,

    CONSTRAINT "PracticeQuizAdaptiveNodeOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeQuizAdaptiveElementOverride" (
    "id" SERIAL NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "discrimination" DOUBLE PRECISION,
    "configId" UUID NOT NULL,
    "assignmentId" INTEGER NOT NULL,

    CONSTRAINT "PracticeQuizAdaptiveElementOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptivePracticeQuizAttempt" (
    "id" UUID NOT NULL,
    "status" "AdaptivePracticeQuizAttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentTheta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currentStandardError" DOUBLE PRECISION,
    "finalTheta" DOUBLE PRECISION,
    "finalStandardError" DOUBLE PRECISION,
    "finalLevelId" INTEGER,
    "elapsedSeconds" INTEGER,
    "nextAssignmentId" INTEGER,
    "thetaHistory" JSONB,
    "standardErrorHistory" JSONB,
    "configId" UUID NOT NULL,
    "practiceQuizId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "participationId" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdaptivePracticeQuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptivePracticeQuizResponse" (
    "id" SERIAL NOT NULL,
    "order" INTEGER NOT NULL,
    "response" JSONB NOT NULL,
    "normalizedResponse" JSONB,
    "correct" BOOLEAN NOT NULL,
    "thetaBefore" DOUBLE PRECISION NOT NULL,
    "thetaAfter" DOUBLE PRECISION NOT NULL,
    "standardErrorAfter" DOUBLE PRECISION NOT NULL,
    "elapsedSeconds" INTEGER,
    "attemptId" UUID NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "elementId" INTEGER NOT NULL,
    "elementSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptivePracticeQuizResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdaptivePracticeQuizEstimate" (
    "id" SERIAL NOT NULL,
    "nodeKind" "AdaptiveEstimateNodeKind" NOT NULL,
    "theta" DOUBLE PRECISION NOT NULL,
    "standardError" DOUBLE PRECISION,
    "responseCount" INTEGER NOT NULL,
    "stopReason" TEXT,
    "attemptId" UUID NOT NULL,
    "nodeId" INTEGER,
    "levelId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdaptivePracticeQuizEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ct_owner_idx" ON "CompetenceTree"("ownerId");
CREATE UNIQUE INDEX "ctc_tree_course_key" ON "CompetenceTreeCourse"("treeId", "courseId");
CREATE INDEX "ctc_course_idx" ON "CompetenceTreeCourse"("courseId");
CREATE INDEX "ctc_linked_by_idx" ON "CompetenceTreeCourse"("linkedById");
CREATE UNIQUE INDEX "ctl_tree_label_key" ON "CompetenceTreeLevel"("treeId", "label");
CREATE UNIQUE INDEX "ctl_tree_order_key" ON "CompetenceTreeLevel"("treeId", "order");
CREATE UNIQUE INDEX "ctn_tree_parent_order_key" ON "CompetenceTreeNode"("treeId", "parentId", "order");
CREATE UNIQUE INDEX "ctn_tree_root_order_key" ON "CompetenceTreeNode"("treeId", "order") WHERE "parentId" IS NULL;
CREATE INDEX "ctn_tree_order_idx" ON "CompetenceTreeNode"("treeId", "order");
CREATE INDEX "ctn_tree_parent_idx" ON "CompetenceTreeNode"("treeId", "parentId");
CREATE UNIQUE INDEX "ctlc_tree_leaf_level_key" ON "CompetenceTreeLeafLevelCoverage"("treeId", "leafNodeId", "levelId");
CREATE UNIQUE INDEX "ctea_tree_element_key" ON "CompetenceTreeElementAssignment"("treeId", "elementId");
CREATE INDEX "ctea_element_idx" ON "CompetenceTreeElementAssignment"("elementId");
CREATE INDEX "ctea_tree_leaf_enabled_idx" ON "CompetenceTreeElementAssignment"("treeId", "leafNodeId", "enabled");
CREATE UNIQUE INDEX "pqac_practice_quiz_key" ON "PracticeQuizAdaptiveConfig"("practiceQuizId");
CREATE INDEX "pqac_tree_idx" ON "PracticeQuizAdaptiveConfig"("competenceTreeId");
CREATE UNIQUE INDEX "pqan_config_node_key" ON "PracticeQuizAdaptiveNodeOverride"("configId", "nodeId");
CREATE UNIQUE INDEX "pqae_config_assignment_key" ON "PracticeQuizAdaptiveElementOverride"("configId", "assignmentId");
CREATE INDEX "apqa_quiz_participant_status_idx" ON "AdaptivePracticeQuizAttempt"("practiceQuizId", "participantId", "status");
CREATE INDEX "apqa_participation_quiz_idx" ON "AdaptivePracticeQuizAttempt"("participationId", "practiceQuizId");
CREATE INDEX "apqa_final_level_idx" ON "AdaptivePracticeQuizAttempt"("finalLevelId");
CREATE INDEX "apqa_next_assignment_idx" ON "AdaptivePracticeQuizAttempt"("nextAssignmentId");
CREATE UNIQUE INDEX "apqa_one_in_progress_key" ON "AdaptivePracticeQuizAttempt"("practiceQuizId", "participantId") WHERE "status" = 'IN_PROGRESS';
CREATE UNIQUE INDEX "apqr_attempt_order_key" ON "AdaptivePracticeQuizResponse"("attemptId", "order");
CREATE UNIQUE INDEX "apqr_attempt_assignment_key" ON "AdaptivePracticeQuizResponse"("attemptId", "assignmentId");
CREATE INDEX "apqr_assignment_idx" ON "AdaptivePracticeQuizResponse"("assignmentId");
CREATE UNIQUE INDEX "apqe_attempt_kind_node_key" ON "AdaptivePracticeQuizEstimate"("attemptId", "nodeKind", "nodeId");
CREATE UNIQUE INDEX "apqe_attempt_kind_overall_key" ON "AdaptivePracticeQuizEstimate"("attemptId", "nodeKind") WHERE "nodeId" IS NULL;
CREATE INDEX "apqe_kind_level_idx" ON "AdaptivePracticeQuizEstimate"("nodeKind", "levelId");

-- AddForeignKey
ALTER TABLE "CompetenceTree" ADD CONSTRAINT "CompetenceTree_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeCourse" ADD CONSTRAINT "CompetenceTreeCourse_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "CompetenceTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeCourse" ADD CONSTRAINT "CompetenceTreeCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeCourse" ADD CONSTRAINT "CompetenceTreeCourse_linkedById_fkey" FOREIGN KEY ("linkedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeLevel" ADD CONSTRAINT "CompetenceTreeLevel_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "CompetenceTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeNode" ADD CONSTRAINT "CompetenceTreeNode_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "CompetenceTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeNode" ADD CONSTRAINT "CompetenceTreeNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CompetenceTreeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeLeafLevelCoverage" ADD CONSTRAINT "CompetenceTreeLeafLevelCoverage_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "CompetenceTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeLeafLevelCoverage" ADD CONSTRAINT "CompetenceTreeLeafLevelCoverage_leafNodeId_fkey" FOREIGN KEY ("leafNodeId") REFERENCES "CompetenceTreeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeLeafLevelCoverage" ADD CONSTRAINT "CompetenceTreeLeafLevelCoverage_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "CompetenceTreeLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeElementAssignment" ADD CONSTRAINT "CompetenceTreeElementAssignment_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "CompetenceTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeElementAssignment" ADD CONSTRAINT "CompetenceTreeElementAssignment_elementId_fkey" FOREIGN KEY ("elementId") REFERENCES "Element"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeElementAssignment" ADD CONSTRAINT "CompetenceTreeElementAssignment_leafNodeId_fkey" FOREIGN KEY ("leafNodeId") REFERENCES "CompetenceTreeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetenceTreeElementAssignment" ADD CONSTRAINT "CompetenceTreeElementAssignment_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "CompetenceTreeLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PracticeQuizAdaptiveConfig" ADD CONSTRAINT "PracticeQuizAdaptiveConfig_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeQuizAdaptiveConfig" ADD CONSTRAINT "PracticeQuizAdaptiveConfig_competenceTreeId_fkey" FOREIGN KEY ("competenceTreeId") REFERENCES "CompetenceTree"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PracticeQuizAdaptiveNodeOverride" ADD CONSTRAINT "PracticeQuizAdaptiveNodeOverride_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PracticeQuizAdaptiveConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeQuizAdaptiveNodeOverride" ADD CONSTRAINT "PracticeQuizAdaptiveNodeOverride_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CompetenceTreeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeQuizAdaptiveElementOverride" ADD CONSTRAINT "PracticeQuizAdaptiveElementOverride_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PracticeQuizAdaptiveConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PracticeQuizAdaptiveElementOverride" ADD CONSTRAINT "PracticeQuizAdaptiveElementOverride_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CompetenceTreeElementAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptivePracticeQuizAttempt" ADD CONSTRAINT "AdaptivePracticeQuizAttempt_configId_fkey" FOREIGN KEY ("configId") REFERENCES "PracticeQuizAdaptiveConfig"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptivePracticeQuizAttempt" ADD CONSTRAINT "AdaptivePracticeQuizAttempt_practiceQuizId_fkey" FOREIGN KEY ("practiceQuizId") REFERENCES "PracticeQuiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptivePracticeQuizAttempt" ADD CONSTRAINT "AdaptivePracticeQuizAttempt_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptivePracticeQuizAttempt" ADD CONSTRAINT "AdaptivePracticeQuizAttempt_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptivePracticeQuizAttempt" ADD CONSTRAINT "AdaptivePracticeQuizAttempt_finalLevelId_fkey" FOREIGN KEY ("finalLevelId") REFERENCES "CompetenceTreeLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdaptivePracticeQuizAttempt" ADD CONSTRAINT "AdaptivePracticeQuizAttempt_nextAssignmentId_fkey" FOREIGN KEY ("nextAssignmentId") REFERENCES "CompetenceTreeElementAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdaptivePracticeQuizResponse" ADD CONSTRAINT "AdaptivePracticeQuizResponse_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AdaptivePracticeQuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptivePracticeQuizResponse" ADD CONSTRAINT "AdaptivePracticeQuizResponse_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "CompetenceTreeElementAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AdaptivePracticeQuizEstimate" ADD CONSTRAINT "AdaptivePracticeQuizEstimate_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "AdaptivePracticeQuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdaptivePracticeQuizEstimate" ADD CONSTRAINT "AdaptivePracticeQuizEstimate_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "CompetenceTreeNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdaptivePracticeQuizEstimate" ADD CONSTRAINT "AdaptivePracticeQuizEstimate_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "CompetenceTreeLevel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
