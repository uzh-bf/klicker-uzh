import { Priority, type HatchetClient } from '@hatchet-dev/typescript-sdk'
import { prisma } from '@klicker-uzh/prisma'
import type { HatchetHandlers } from '@klicker-uzh/types'
import type EventEmitter from 'events'
import type { PubSub } from 'graphql-yoga'
import type { Redis } from 'ioredis'

export * from './client.js'

export type { HatchetHandlers } from '@klicker-uzh/types'

export function prepareHatchetTasks({
  hatchet,
  pubSub,
  emitter,
  redisExec,
  redisCache,
  handlers,
}: {
  hatchet: HatchetClient
  pubSub: PubSub<any>
  emitter: EventEmitter
  redisExec: Redis
  redisCache?: Redis
  handlers: HatchetHandlers
}) {
  const ctx = {
    hatchet,
    pubSub,
    emitter,
    redisExec,
    redisCache,
    prisma,
  }

  // ! AUDIT LOGGING
  // #region
  const createAuditLogEntry = hatchet.task({
    name: 'create-audit-log-entry',
    retries: 3,
    defaultPriority: Priority.LOW,
    onEvents: ['create-audit-log-entry'],
    fn: (
      message: Record<string, string | undefined> & {
        correlationId?: string
        info: string
      },
      ctx
    ) => {
      const { info, ...args } = message

      // TODO: send the message to the actual audit log service with the correlation ID as a key?
      ctx.logger.info(`Audit log entry: ${info}`, args)
    },
  })
  // #endregion

  // ! ACTIVITY PUBLICATION TASKS
  // #region
  const publishScheduledMicroLearning = hatchet.task({
    name: 'publish-scheduled-microlearning',
    retries: 3,
    fn: async ({ microLearningId }: { microLearningId: string }) => {
      const success = await handlers.handlePublishScheduledMicroLearning(
        { microLearningId },
        ctx
      )
      return { success }
    },
  })

  const publishScheduledGroupActivity = hatchet.task({
    name: 'publish-scheduled-group-activity',
    retries: 3,
    fn: async ({ groupActivityId }: { groupActivityId: string }) => {
      const success = await handlers.handlePublishScheduledGroupActivity(
        { groupActivityId },
        ctx
      )
      return { success }
    },
  })

  const publishScheduledPracticeQuiz = hatchet.task({
    name: 'publish-scheduled-practice-quiz',
    retries: 3,
    fn: async ({ practiceQuizId }: { practiceQuizId: string }) => {
      const success = await handlers.handlePublishScheduledPracticeQuiz(
        { practiceQuizId },
        ctx
      )
      return { success }
    },
  })

  const publishScheduledLiveQuiz = hatchet.task({
    name: 'publish-scheduled-live-quiz',
    retries: 3,
    fn: async ({ liveQuizId }: { liveQuizId: string }) => {
      const success = await handlers.handlePublishScheduledLiveQuiz(
        { liveQuizId },
        ctx
      )
      return { success }
    },
  })

  // #endregion

  // ! ACTIVITY ENDING TASKS
  // #region
  const endExpiredMicroLearning = hatchet.task({
    name: 'end-expired-micro-learnings',
    retries: 3,
    fn: async ({ microLearningId }: { microLearningId: string }) => {
      const success = await handlers.handleEndExpiredMicroLearning(
        { microLearningId },
        ctx
      )
      return { success }
    },
  })

  const endExpiredGroupActivity = hatchet.task({
    name: 'end-expired-group-activities',
    retries: 3,
    fn: async ({ groupActivityId }: { groupActivityId: string }) => {
      const success = await handlers.handleEndExpiredGroupActivity(
        { groupActivityId },
        ctx
      )
      return { success }
    },
  })

  // #endregion

  // ! CRONJOBS
  // #region
  const updateGroupAverageScores = hatchet.task({
    name: 'update-group-average-scores',
    retries: 3,
    onCrons: [
      '5 0 * * *', // running daily at 12:05 AM (UTC)
    ],
    fn: async () => {
      const success = await handlers.handleUpdateGroupAverageScores({}, ctx)
      return { success }
    },
  })

  const runningRandomGroupAssignments = hatchet.task({
    name: 'running-random-group-assignments',
    retries: 3,
    onCrons: [
      '10 0 * * *', // running daily at 12:10 AM (UTC)
    ],
    fn: async () => {
      const success = await handlers.handleRunningRandomGroupAssignments(
        {},
        ctx
      )
      return { success }
    },
  })

  const finalRandomGroupAssignments = hatchet.task({
    name: 'final-random-group-assignments',
    retries: 3,
    onCrons: [
      '15 0 * * *', // running daily at 12:15 AM (UTC)
    ],
    fn: async () => {
      const success = await handlers.handleFinalRandomGroupAssignments({}, ctx)
      return { success }
    },
  })

  const updateWeeklyTimelineEntries = hatchet.task({
    name: 'update-weekly-timeline-entries',
    retries: 3,
    onCrons: [
      '20 0 * * *', // running daily at 12:20 AM (UTC)
    ],
    fn: async () => {
      const success = await handlers.handleUpdateWeeklyTimelineEntries({}, ctx)
      return { success }
    },
  })

  const sendPushNotifications = hatchet.task({
    name: 'send-push-notifications',
    retries: 3,
    onCrons: [
      '*/5 * * * *', // runs every 5 minutes
    ],
    fn: async () => {
      const success = await handlers.handleSendPushNotifications({}, ctx)
      return { success }
    },
  })
  // #endregion

  return {
    updateGroupAverageScores,
    runningRandomGroupAssignments,
    finalRandomGroupAssignments,
    updateWeeklyTimelineEntries,
    sendPushNotifications,
    publishScheduledGroupActivity,
    publishScheduledLiveQuiz,
    publishScheduledMicroLearning,
    publishScheduledPracticeQuiz,
    endExpiredGroupActivity,
    endExpiredMicroLearning,
    createAuditLogEntry,
  }
}

// Export the inferred type of the tasks dictionary so other packages can import it
export type PreparedHatchetTasks = ReturnType<typeof prepareHatchetTasks>
