import type {
  Context,
  HatchetClient,
  JsonObject,
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

export const kbIngestionSpeedModes = ['balanced', 'quality', 'fast'] as const
export type KBIngestionSpeedMode = (typeof kbIngestionSpeedModes)[number]

export const kbIngestionModelIds = [
  // Default
  'klickeruzh/azure/gpt-4.1',
  'klickeruzh/azure/gpt-4.1-mini',
  'klickeruzh/azure/gpt-4.1-nano',
  'klickeruzh/azure/gpt-5.1',
  'klickeruzh/azure/gpt-5.4',
  'klickeruzh/azure/gpt-5.5',
  // Swiss Foundry
  'klickeruzh/azure/gpt-5.4-low',
  'klickeruzh/azure/gpt-5.4-medium',
  'klickeruzh/azure/gpt-5.5-low',
  'klickeruzh/azure/gpt-5.6-sol',
  'klickeruzh/azure/gpt-5.6-terra',
  'klickeruzh/azure/gpt-5.6-luna',
  'klickeruzh/azure/gpt-5.6-luna-medium',
  'klickeruzh/azure/gpt-5.6-luna-high',
  'klickeruzh/azure/gpt-5.6-luna-xhigh',
  'klickeruzh/azure/gpt-5.6-sol-low',
  'klickeruzh/azure/gpt-5.6-sol-medium',
] as const

export type KBIngestionModelId = (typeof kbIngestionModelIds)[number]

export function isKBIngestionModelId(
  value: string
): value is KBIngestionModelId {
  return (kbIngestionModelIds as readonly string[]).includes(value)
}

type IngestKBResourceInputBase = JsonObject & {
  resourceId: string
  kbId: string
  title: string
  ingestionAttemptId: string
  speedMode: KBIngestionSpeedMode
}

export type IngestKBResourceInput = IngestKBResourceInputBase &
  (
    | {
        type: 'BLOB'
        blobName: string
        containerName: string
      }
    | {
        type: 'URL'
        sourceUrl: string
      }
  )

export type BuildChatbotKnowledgeGraphInput = JsonObject & {
  graphId: string
  chatbotId: string
  attemptId: string
  selectionRevision: number
  speedMode: KBIngestionSpeedMode
  generationModel: KBIngestionModelId
  cleaningModel: KBIngestionModelId
  resources: Array<
    | {
        resourceId: string
        title: string
        type: 'BLOB'
        blobName: string
        containerName: string
      }
    | {
        resourceId: string
        title: string
        type: 'URL'
        sourceUrl: string
      }
  >
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
}

// Contract for the tasks that are passed into the GraphQL context.
export interface PreparedHatchetTasks {
  buildChatbotKnowledgeGraph: TaskWorkflowDeclaration<
    BuildChatbotKnowledgeGraphInput,
    { success: boolean }
  >
  ingestKBResource: TaskWorkflowDeclaration<
    IngestKBResourceInput,
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
}
