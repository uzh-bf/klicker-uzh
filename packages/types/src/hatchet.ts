import type {
  HatchetClient,
  TaskWorkflowDeclaration,
} from '@hatchet-dev/typescript-sdk/index.js'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type EventEmitter from 'events'
import type { PubSub } from 'graphql-yoga'
import type { Redis } from 'ioredis'

export interface HatchetHandlerContext {
  hatchet: HatchetClient
  pubSub: PubSub<any>
  emitter: EventEmitter
  redisExec: Redis
  redisCache?: Redis
  prisma: PrismaClient
}

// Shared contract for Hatchet task handler injections.
export interface HatchetHandlers {
  handleSendTeamsNotification: (
    { scope, text }: { scope: string; text: string },
    ctx: HatchetHandlerContext
  ) => Promise<unknown> | void
  handleUpdateGroupAverageScores: (
    {},
    ctx: HatchetHandlerContext
  ) => Promise<boolean>
  handleRunningRandomGroupAssignments: (
    {},
    ctx: HatchetHandlerContext
  ) => Promise<boolean>
  handleFinalRandomGroupAssignments: (
    {},
    ctx: HatchetHandlerContext
  ) => Promise<boolean>
  handleUpdateWeeklyTimelineEntries: (
    {},
    ctx: HatchetHandlerContext
  ) => Promise<boolean>
  handleSendPushNotifications: (
    {},
    ctx: HatchetHandlerContext
  ) => Promise<boolean>
  handleEndExpiredGroupActivity: (
    { groupActivityId }: { groupActivityId: string },
    ctx: HatchetHandlerContext
  ) => Promise<boolean>
  handleEndExpiredMicroLearning: (
    { microLearningId }: { microLearningId: string },
    ctx: HatchetHandlerContext
  ) => Promise<boolean>
  handlePublishScheduledLiveQuiz: (
    { liveQuizId }: { liveQuizId: string },
    ctx: HatchetHandlerContext
  ) => Promise<boolean>
  handlePublishScheduledPracticeQuiz: (
    { practiceQuizId }: { practiceQuizId: string },
    ctx: HatchetHandlerContext
  ) => Promise<boolean>
  handlePublishScheduledGroupActivity: (
    { groupActivityId }: { groupActivityId: string },
    ctx: HatchetHandlerContext
  ) => Promise<boolean>
  handlePublishScheduledMicroLearning: (
    { microLearningId }: { microLearningId: string },
    ctx: HatchetHandlerContext
  ) => Promise<boolean>
}

// Contract for the tasks that are passed into the GraphQL context.
export interface PreparedHatchetTasks {
  publishScheduledMicroLearning: TaskWorkflowDeclaration<
    {
      microLearningId: string
    },
    { success: boolean }
  >
  publishScheduledPracticeQuiz: TaskWorkflowDeclaration<
    {
      practiceQuizId: string
    },
    { success: boolean }
  >
  publishScheduledGroupActivity: TaskWorkflowDeclaration<
    {
      groupActivityId: string
    },
    { success: boolean }
  >
  publishScheduledLiveQuiz: TaskWorkflowDeclaration<
    {
      liveQuizId: string
    },
    { success: boolean }
  >
  endExpiredMicroLearning: TaskWorkflowDeclaration<
    {
      microLearningId: string
    },
    { success: boolean }
  >
  endExpiredGroupActivity: TaskWorkflowDeclaration<
    {
      groupActivityId: string
    },
    { success: boolean }
  >
}
