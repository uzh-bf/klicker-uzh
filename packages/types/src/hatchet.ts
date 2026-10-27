import type EventEmitter from 'node:events'
import type {
  Context,
  HatchetClient,
  JsonObject,
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

export const MAX_KB_RESOURCE_COUNT = 1000
export const MAX_KB_SOURCE_SIZE_BYTES = 25 * 1024 * 1024
const KB_BYTES_PER_MIB = 1024 * 1024
export const DEFAULT_KB_STORAGE_LIMIT_MIB = 500
export const MAX_KB_STORAGE_LIMIT_MIB = 2_147_483_647
export const MAX_KB_TOTAL_SIZE_BYTES =
  DEFAULT_KB_STORAGE_LIMIT_MIB * KB_BYTES_PER_MIB

export function resolveKBStorageLimitBytes(
  storageLimitMiB: number | null | undefined
): number {
  const effectiveLimitMiB = storageLimitMiB ?? DEFAULT_KB_STORAGE_LIMIT_MIB
  if (
    !Number.isSafeInteger(effectiveLimitMiB) ||
    effectiveLimitMiB <= 0 ||
    effectiveLimitMiB > MAX_KB_STORAGE_LIMIT_MIB
  ) {
    throw new Error('Invalid KB storage limit')
  }

  const limitBytes = effectiveLimitMiB * KB_BYTES_PER_MIB
  if (!Number.isSafeInteger(limitBytes)) {
    throw new Error('Invalid KB storage limit')
  }
  return limitBytes
}

type IngestKBResourceInputBase = JsonObject & {
  resourceId: string
  kbId: string
  title: string
  ingestionAttemptId: string
  resourceVersion: number
}

export type IngestKBResourceInput = IngestKBResourceInputBase &
  (
    | {
        type: 'BLOB'
        blobName: string
        containerName: string
        mimeType: string
        sizeBytes: number
      }
    | {
        type: 'URL'
        sourceUrl: string
      }
  )

export type DeleteKBResourceInput = JsonObject & {
  resourceId: string
  kbId: string
  deletionAttemptId: string
  resourceVersion: number
}

export type BuildKBGraphInput = JsonObject & {
  buildId: string
}

// Shared contract for Hatchet task handler injections.
// Payload of the `process-course-deletion` event. The request marker on the
// course is the only persisted state; requester and options travel here.
export type CourseDeletionEvent = {
  courseId: string
  deletionRequestedAt: string
  requestedById: string
  deleteDraftActivities: boolean
}

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
    { jobId }: { jobId: string },
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleSweepStaleCourseDuplications: (
    _args: Record<string, never>,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
  handleProcessCourseDeletion: (
    input: CourseDeletionEvent,
    globalCtx: HatchetHandlerGlobalContext,
    executionCtx: Context<unknown>
  ) => Promise<boolean>
}

// Contract for the tasks that are passed into the GraphQL context.
export interface PreparedHatchetTasks {
  ingestKBResource: TaskWorkflowDeclaration<
    IngestKBResourceInput,
    { success: boolean }
  >
  deleteKBResource: TaskWorkflowDeclaration<
    DeleteKBResourceInput,
    { success: boolean }
  >
  buildKBGraph: TaskWorkflowDeclaration<BuildKBGraphInput, { success: boolean }>
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
  processCourseDeletion: TaskWorkflowDeclaration<
    CourseDeletionEvent,
    { success: boolean }
  >
}
