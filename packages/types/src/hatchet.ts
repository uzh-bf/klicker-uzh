import type { TaskWorkflowDeclaration } from '@hatchet-dev/typescript-sdk/index.js'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type EventEmitter from 'events'

// Shared contract for Hatchet task handler injections.
export interface HatchetHandlers {
  sendTeamsNotifications: (
    scope: string,
    text: string
  ) => Promise<unknown> | void
  updateGroupAverageScores: (
    prisma: PrismaClient,
    emitter: EventEmitter
  ) => Promise<boolean>
  runningRandomGroupAssignments: (
    prisma: PrismaClient,
    emitter: EventEmitter
  ) => Promise<boolean>
  finalRandomGroupAssignments: (
    prisma: PrismaClient,
    emitter: EventEmitter
  ) => Promise<boolean>
  updateWeeklyTimelineEntries: (prisma: PrismaClient) => Promise<boolean>
  sendPushNotifications: (prisma: PrismaClient) => Promise<boolean>
}

// Contract for the tasks that are passed into the GraphQL context.
export interface PreparedHatchetTasks {
  publishScheduledMicroLearningTask: TaskWorkflowDeclaration<{
    microLearningId: string
  }>
  publishScheduledPracticeQuizTask: TaskWorkflowDeclaration<{
    practiceQuizId: string
  }>
  publishScheduledGroupActivityTask: TaskWorkflowDeclaration<{
    groupActivityId: string
  }>
  publishScheduledLiveQuizTask: TaskWorkflowDeclaration<{
    liveQuizId: string
  }>
  endExpiredMicroLearningTask: TaskWorkflowDeclaration<{
    microLearningId: string
  }>
  endExpiredGroupActivityTask: TaskWorkflowDeclaration<{
    groupActivityId: string
  }>
}
