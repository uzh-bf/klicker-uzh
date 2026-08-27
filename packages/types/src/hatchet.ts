import type EventEmitter from 'node:events'
import type {
  Context,
  HatchetClient,
  TaskWorkflowDeclaration,
} from '@hatchet-dev/typescript-sdk/index.js'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { PubSub } from 'graphql-yoga'
import type { Redis } from 'ioredis'

export type LearningAnalyticsCourseMode = 'finalize' | 'full' | 'incremental'

export type LearningAnalyticsCourseControlInput = {
  contractVersion: 'v1'
  runId: string
  courseId: string
  mode: LearningAnalyticsCourseMode
  windowSince?: string
}

export type LearningAnalyticsCourseControlOutput = {
  courseId: string
  completedAt: string
  cleanupOnly: boolean
}

export type LearningAnalyticsCourseStartOutput = {
  courseId: string
  cleanupOnly: boolean
  fenceAt: string
}

export type LearningAnalyticsCourseCompletionInput = {
  request: LearningAnalyticsCourseControlInput
  completedAt: string
  cleanupOnly: boolean
  fenceAt: string
}

export type LearningAnalyticsBatchControlInput = {
  runId: string
  batchDate: string
  selection: 'explicit-full' | 'nightly'
  explicitCourseIds?: string[]
  includePlatform: boolean
  inFlightLimit: number
  stopSpawningAt: string
  hardDeadlineAt: string
}

export type LearningAnalyticsBatchDeadlineInput = {
  hardDeadlineAt: string
}

export type LearningAnalyticsBatchDeadlineOutput = {
  remainingSeconds: number
}

export type LearningAnalyticsBatchSelectionOutput = {
  courses: LearningAnalyticsCourseControlInput[]
}

export type LearningAnalyticsBatchLaneInput = {
  runId: string
  courses: LearningAnalyticsCourseControlInput[]
  stopSpawningAt: string
}

export type LearningAnalyticsBatchLaneOutput = {
  completedCourseIds: string[]
  failedCourseIds: string[]
  notStartedCourseIds: string[]
}

export type LearningAnalyticsBatchControlOutput = {
  runId: string
  selectedCourses: number
  completedCourses: number
  platformCompletedAt?: string
}

export interface HatchetHandlerGlobalContext {
  hatchet: HatchetClient
  pubSub: PubSub<any>
  emitter: EventEmitter
  redisExec: Redis
  redisAssessmentExec: Redis
  redisCache?: Redis
  prisma: PrismaClient
  tasks: PreparedHatchetTasks
}

// Shared contract for Hatchet task handler injections.
export interface HatchetHandlers {
  handlePrepareScheduledLearningAnalyticsBatch: (
    _args: Record<string, never>,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<LearningAnalyticsBatchControlInput | null>
  handleSelectLearningAnalyticsBatchCourses: (
    args: LearningAnalyticsBatchControlInput,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<LearningAnalyticsBatchSelectionOutput>
  handleGetLearningAnalyticsBatchDeadline: (
    args: LearningAnalyticsBatchDeadlineInput,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<LearningAnalyticsBatchDeadlineOutput>
  handleCanStartLearningAnalyticsCourse: (
    args: { stopSpawningAt: string },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleStartLearningAnalyticsCourse: (
    args: LearningAnalyticsCourseControlInput,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<LearningAnalyticsCourseStartOutput>
  handleCompleteLearningAnalyticsCourse: (
    args: LearningAnalyticsCourseCompletionInput,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<LearningAnalyticsCourseControlOutput>
  handleSendTeamsNotification: (
    { scope, text }: { scope: string; text: string },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<unknown> | undefined
  handleUpdateGroupAverageScores: (
    _args: Record<string, never>,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleRunningRandomGroupAssignments: (
    _args: Record<string, never>,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleFinalRandomGroupAssignments: (
    _args: Record<string, never>,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleUpdateWeeklyTimelineEntries: (
    _args: Record<string, never>,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleSendPushNotifications: (
    _args: Record<string, never>,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleEndExpiredGroupActivity: (
    { groupActivityId }: { groupActivityId: string },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleEndExpiredMicroLearning: (
    { microLearningId }: { microLearningId: string },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handlePublishScheduledLiveQuiz: (
    { liveQuizId }: { liveQuizId: string },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handlePublishScheduledPracticeQuiz: (
    { practiceQuizId }: { practiceQuizId: string },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handlePublishScheduledGroupActivity: (
    { groupActivityId }: { groupActivityId: string },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handlePublishScheduledMicroLearning: (
    { microLearningId }: { microLearningId: string },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleAssessmentLiveQuizBlockClosureAggregation: (
    { liveQuizId, blockId }: { liveQuizId: string; blockId: number },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleStandardLiveQuizBlockClosureAggregation: (
    { liveQuizId, blockId }: { liveQuizId: string; blockId: number },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleProcessCourseDuplication: (
    { jobId }: { jobId: string },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleSweepStaleCourseDuplications: (
    _args: Record<string, never>,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
}

// Contract for the tasks that are passed into the GraphQL context.
export interface PreparedHatchetTasks {
  learningAnalyticsScheduledDispatch: TaskWorkflowDeclaration<
    Record<string, never>,
    { dispatched: boolean; runId?: string }
  >
  learningAnalyticsBatchCoordinator: TaskWorkflowDeclaration<
    LearningAnalyticsBatchControlInput,
    LearningAnalyticsBatchControlOutput
  >
  learningAnalyticsBatchSelector: TaskWorkflowDeclaration<
    LearningAnalyticsBatchControlInput,
    LearningAnalyticsBatchSelectionOutput
  >
  learningAnalyticsBatchDeadline: TaskWorkflowDeclaration<
    LearningAnalyticsBatchDeadlineInput,
    LearningAnalyticsBatchDeadlineOutput
  >
  learningAnalyticsBatchLane: TaskWorkflowDeclaration<
    LearningAnalyticsBatchLaneInput,
    LearningAnalyticsBatchLaneOutput
  >
  learningAnalyticsSpawnGate: TaskWorkflowDeclaration<
    { stopSpawningAt: string },
    { canStart: boolean }
  >
  learningAnalyticsCourseCoordinator: TaskWorkflowDeclaration<
    LearningAnalyticsCourseControlInput,
    LearningAnalyticsCourseControlOutput
  >
  learningAnalyticsCourseStart: TaskWorkflowDeclaration<
    LearningAnalyticsCourseControlInput,
    LearningAnalyticsCourseStartOutput
  >
  learningAnalyticsCourseCompletion: TaskWorkflowDeclaration<
    LearningAnalyticsCourseCompletionInput,
    LearningAnalyticsCourseControlOutput
  >
  createAuditLogEntry: TaskWorkflowDeclaration<
    {
      message: Record<string, string | undefined> & {
        correlationId?: string
        info: string
      }
    },
    { success: boolean }
  >
  publishScheduledMicroLearning: TaskWorkflowDeclaration<
    { microLearningId: string },
    { success: boolean }
  >
  publishScheduledPracticeQuiz: TaskWorkflowDeclaration<
    { practiceQuizId: string },
    { success: boolean }
  >
  publishScheduledGroupActivity: TaskWorkflowDeclaration<
    { groupActivityId: string },
    { success: boolean }
  >
  publishScheduledLiveQuiz: TaskWorkflowDeclaration<
    { liveQuizId: string },
    { success: boolean }
  >
  endExpiredMicroLearning: TaskWorkflowDeclaration<
    { microLearningId: string },
    { success: boolean }
  >
  endExpiredGroupActivity: TaskWorkflowDeclaration<
    { groupActivityId: string },
    { success: boolean }
  >
  aggregateLiveQuizBlockResultsStandard: TaskWorkflowDeclaration<
    { liveQuizId: string; blockId: number },
    { success: boolean }
  >
  aggregateLiveQuizBlockResultsAssessment: TaskWorkflowDeclaration<
    { liveQuizId: string; blockId: number },
    { success: boolean }
  >
  processCourseDuplication: TaskWorkflowDeclaration<
    { jobId: string },
    { success: boolean }
  >
  sweepStaleCourseDuplications: TaskWorkflowDeclaration<
    Record<string, never>,
    { success: boolean }
  >
}
