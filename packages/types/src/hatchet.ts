import type {
  Context,
  HatchetClient,
  TaskWorkflowDeclaration,
  WorkflowDeclaration,
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
  handleRunAnalyticsScript: (
    input: RunAnalyticsScriptInput,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<void>
}

// Script module names — must match the Python modules under
// apps/analytics/src/scripts. Kept here (the shared `@klicker-uzh/types`
// package) so `@klicker-uzh/graphql` and `@klicker-uzh/hatchet` don't drift
// their own copies. No user-supplied script names ever reach spawn() — the
// Hatchet workflow references them by symbol.
export const ANALYTICS_SCRIPTS = {
  s0_participant: 'src.scripts.0_initial_participant_analytics',
  s1_aggregated: 'src.scripts.1_initial_aggregated_analytics',
  s2_course_heatmap: 'src.scripts.2_initial_aggregated_course_analytics',
  s3_instance_activity: 'src.scripts.3_initial_instance_activity_performance',
  s4_participant_perf: 'src.scripts.4_initial_participant_performance',
  s5_participant_course: 'src.scripts.5_initial_participant_course_analytics',
  s6_activity_progress: 'src.scripts.6_initial_activity_progress',
  s7_participant_activity: 'src.scripts.7_participant_activity_performance',
  s8_chat: 'src.scripts.8_initial_chat_analytics',
  s9_chatbot: 'src.scripts.9_initial_aggregated_chatbot_analytics',
  s10_clustering: 'src.scripts.10_chat_topic_clustering',
  s11_chat_quiz: 'src.scripts.11_chat_quiz_correlation',
  s13_platform: 'src.scripts.13_platform_semester_analytics',
  s14_live_quiz: 'src.scripts.14_live_quiz_assessment_analytics',
  s99_validity: 'src.scripts.99_mark_analytics_valid',
} as const

export type AnalyticsScriptKey = keyof typeof ANALYTICS_SCRIPTS

// Input shape for the weekly learning-analytics recompute. `mode` defaults to
// incremental; the scanner sends `courseId` alone and the workflow promotes it
// to finalize for that course.
export type RecomputeLearningAnalyticsInput = {
  mode?: 'incremental' | 'finalize' | 'full'
  courseIds?: string[]
  courseId?: string
  windowSince?: string
}

// Per-task input — each task in the analytics DAG receives the workflow-level
// input plus the Python module it should invoke. `scriptModule` is not set by
// callers; the Hatchet workflow wires it in per task node.
export type RunAnalyticsScriptInput = RecomputeLearningAnalyticsInput & {
  scriptModule: string
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
  // DAG workflow, not a flat task: 15 per-script sub-tasks executed in
  // parallel branches per the script dependency graph. Output is the map of
  // task name → task output; shape is open because the number of task outputs
  // is only meaningful inside the DAG, not to external callers.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  recomputeLearningAnalytics: WorkflowDeclaration<
    RecomputeLearningAnalyticsInput,
    {}
  >
}
