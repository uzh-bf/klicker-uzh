import type EventEmitter from 'node:events'
import type {
  Context,
  HatchetClient,
  TaskWorkflowDeclaration,
} from '@hatchet-dev/typescript-sdk/index.js'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { AppLogger } from '@klicker-uzh/logging/node'
import type { PubSub } from 'graphql-yoga'
import type { Redis } from 'ioredis'

export interface HatchetHandlerGlobalContext {
  hatchet: HatchetClient
  pubSub: PubSub<any>
  emitter: EventEmitter
  redisExec: Redis
  redisAssessmentExec: Redis
  redisCache?: Redis
  prisma: PrismaClient
  tasks: PreparedHatchetTasks
  log?: AppLogger
}

export type HatchetLoggingContext = {
  requestId?: string
  correlationId?: string
}

// Shared contract for Hatchet task handler injections.
export interface HatchetHandlers {
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
    {
      jobId,
      loggingContext,
    }: { jobId: string; loggingContext?: HatchetLoggingContext },
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
  createAuditLogEntry: TaskWorkflowDeclaration<
    {
      message: Record<string, string | HatchetLoggingContext | undefined> & {
        correlationId?: string
        info: string
        loggingContext?: HatchetLoggingContext
      }
    },
    { success: boolean }
  >
  publishScheduledMicroLearning: TaskWorkflowDeclaration<
    { microLearningId: string; loggingContext?: HatchetLoggingContext },
    { success: boolean }
  >
  publishScheduledPracticeQuiz: TaskWorkflowDeclaration<
    { practiceQuizId: string; loggingContext?: HatchetLoggingContext },
    { success: boolean }
  >
  publishScheduledGroupActivity: TaskWorkflowDeclaration<
    { groupActivityId: string; loggingContext?: HatchetLoggingContext },
    { success: boolean }
  >
  publishScheduledLiveQuiz: TaskWorkflowDeclaration<
    { liveQuizId: string; loggingContext?: HatchetLoggingContext },
    { success: boolean }
  >
  endExpiredMicroLearning: TaskWorkflowDeclaration<
    { microLearningId: string; loggingContext?: HatchetLoggingContext },
    { success: boolean }
  >
  endExpiredGroupActivity: TaskWorkflowDeclaration<
    { groupActivityId: string; loggingContext?: HatchetLoggingContext },
    { success: boolean }
  >
  aggregateLiveQuizBlockResultsStandard: TaskWorkflowDeclaration<
    {
      liveQuizId: string
      blockId: number
      loggingContext?: HatchetLoggingContext
    },
    { success: boolean }
  >
  aggregateLiveQuizBlockResultsAssessment: TaskWorkflowDeclaration<
    {
      liveQuizId: string
      blockId: number
      loggingContext?: HatchetLoggingContext
    },
    { success: boolean }
  >
  processCourseDuplication: TaskWorkflowDeclaration<
    { jobId: string; loggingContext?: HatchetLoggingContext },
    { success: boolean }
  >
  sweepStaleCourseDuplications: TaskWorkflowDeclaration<
    { loggingContext?: HatchetLoggingContext },
    { success: boolean }
  >
}
