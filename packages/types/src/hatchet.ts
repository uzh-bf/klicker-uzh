import type {
  Context,
  HatchetClient,
  TaskWorkflowDeclaration,
} from '@hatchet-dev/typescript-sdk/index.js'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type EventEmitter from 'events'
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
}

// Shared contract for Hatchet task handler injections.
export interface HatchetHandlers {
  handleSendTeamsNotification: (
    { scope, text }: { scope: string; text: string },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<unknown> | void
  handleUpdateGroupAverageScores: (
    {},
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleRunningRandomGroupAssignments: (
    {},
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleFinalRandomGroupAssignments: (
    {},
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleUpdateWeeklyTimelineEntries: (
    {},
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleSendPushNotifications: (
    {},
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
  handleRecomputeLearningAnalytics: (
    input: RecomputeLearningAnalyticsInput,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
}

// Input shape for the weekly learning-analytics recompute.
// - `mode=incremental` (default for the weekly cron) narrows the DAILY/WEEKLY/MONTHLY
//   iteration via `windowSince` and skips FROZEN (analyticsFinalizedAt NOT NULL) courses.
// - `mode=finalize` is emitted by the daily scanner per ended course; requires `courseIds`
//   and stamps `analyticsFinalizedAt` when the run succeeds.
// - `mode=full` keeps the original "from 2022-10-23 across every course" behaviour for
//   migrations and one-off backfills.
export type RecomputeLearningAnalyticsInput = {
  mode?: 'incremental' | 'finalize' | 'full'
  courseIds?: string[]
  windowSince?: string
  // Scanner emits `courseEnded` events with a single courseId; the handler
  // treats this as a finalize run for that one course.
  courseId?: string
}

// Named event constants for Hatchet task triggers. Keeping them here instead of
// sprinkling string literals across workflow definitions and emitter call sites.
export const HATCHET_EVENTS = {
  courseEnded: 'course-ended',
  adminRecomputeAnalytics: 'admin-recompute-analytics',
} as const

// Contract for the tasks that are passed into the GraphQL context.
// NOTE: the historical createAuditLogEntry shape disagrees with the real task
// implementation in packages/hatchet/src/index.ts (wrapper vs direct payload);
// GraphQL call sites currently rely on the wrapper shape, so keeping the
// interface as-is avoids disturbing them. Downstream code that needs the real
// inferred shape should import PreparedHatchetTasks from @klicker-uzh/hatchet
// (the ReturnType<typeof prepareHatchetTasks>) instead.
export interface PreparedHatchetTasks {
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
  recomputeLearningAnalytics: TaskWorkflowDeclaration<
    RecomputeLearningAnalyticsInput,
    { success: boolean }
  >
}
