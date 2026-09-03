import type EventEmitter from 'node:events'
import type {
  Context,
  HatchetClient,
  TaskWorkflowDeclaration,
} from '@hatchet-dev/typescript-sdk/index.js'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
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
}

// Shared contract for Hatchet task handler injections.
export interface HatchetHandlers {
  handleDispatchAssessmentAuditOutbox: (
    _input: Record<string, never>,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleMonitorAssessmentAudit: (
    _input: Record<string, never>,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleRenewAssessmentAuditMediaPolicies: (
    _input: Record<string, never>,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
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
    {
      liveQuizId,
      initiatedByUserId,
    }: { liveQuizId: string; initiatedByUserId?: string },
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
  dispatchAssessmentAuditOutbox: TaskWorkflowDeclaration<
    Record<string, never>,
    { success: boolean }
  >
  monitorAssessmentAudit: TaskWorkflowDeclaration<
    Record<string, never>,
    { success: boolean }
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
    { liveQuizId: string; initiatedByUserId?: string },
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
