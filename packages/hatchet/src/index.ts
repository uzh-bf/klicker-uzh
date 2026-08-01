import { Priority, type HatchetClient } from '@hatchet-dev/typescript-sdk'
import { prisma } from '@klicker-uzh/prisma'
import type {
  AdaptiveEmpiricalValidationTaskInput,
  HatchetHandlers,
} from '@klicker-uzh/types'
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
  redisAssessmentExec,
  redisCache,
  handlers,
}: {
  hatchet: HatchetClient
  pubSub: PubSub<any>
  emitter: EventEmitter
  redisExec: Redis
  redisAssessmentExec: Redis
  redisCache?: Redis
  handlers: HatchetHandlers
}) {
  const globalContext = {
    hatchet,
    pubSub,
    emitter,
    redisExec,
    redisAssessmentExec,
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

  // ! ADAPTIVE CALIBRATION DATA GOVERNANCE
  // #region
  const adaptiveEmpiricalValidation = hatchet.task({
    name: 'adaptive-empirical-validation',
    retries: 2,
    fn: async (
      input: AdaptiveEmpiricalValidationTaskInput,
      executionContext
    ) => {
      const validationId = await handlers.handleAdaptiveEmpiricalValidation(
        input,
        globalContext,
        executionContext
      )
      return { validationId }
    },
  })

  const adaptiveCalibrationExport = hatchet.task({
    name: 'adaptive-calibration-export',
    retries: 3,
    fn: async (
      { exportRequestId }: { exportRequestId: string },
      executionContext
    ) => {
      const success = await handlers.handleAdaptiveCalibrationExport(
        { exportRequestId },
        globalContext,
        executionContext
      )
      return { success }
    },
  })

  const adaptiveCalibrationExportCleanup = hatchet.task({
    name: 'adaptive-calibration-export-cleanup',
    retries: 3,
    onCrons: ['15 0 * * *'],
    fn: async (_, executionContext) => {
      const success = await handlers.handleAdaptiveCalibrationExportCleanup(
        {},
        globalContext,
        executionContext
      )
      return { success }
    },
  })
  // #endregion

  // ! ACTIVITY PUBLICATION TASKS
  // #region
  const publishScheduledMicroLearning = hatchet.task({
    name: 'publish-scheduled-microlearning',
    retries: 3,
    fn: async (
      { microLearningId }: { microLearningId: string },
      executionContext
    ) => {
      const success = await handlers.handlePublishScheduledMicroLearning(
        { microLearningId },
        globalContext,
        executionContext
      )
      return { success }
    },
  })

  const publishScheduledGroupActivity = hatchet.task({
    name: 'publish-scheduled-group-activity',
    retries: 3,
    fn: async (
      { groupActivityId }: { groupActivityId: string },
      executionContext
    ) => {
      const success = await handlers.handlePublishScheduledGroupActivity(
        { groupActivityId },
        globalContext,
        executionContext
      )
      return { success }
    },
  })

  const publishScheduledPracticeQuiz = hatchet.task({
    name: 'publish-scheduled-practice-quiz',
    retries: 3,
    fn: async (
      { practiceQuizId }: { practiceQuizId: string },
      executionContext
    ) => {
      const success = await handlers.handlePublishScheduledPracticeQuiz(
        { practiceQuizId },
        globalContext,
        executionContext
      )
      return { success }
    },
  })

  const publishScheduledLiveQuiz = hatchet.task({
    name: 'publish-scheduled-live-quiz',
    retries: 3,
    fn: async ({ liveQuizId }: { liveQuizId: string }, executionContext) => {
      const success = await handlers.handlePublishScheduledLiveQuiz(
        { liveQuizId },
        globalContext,
        executionContext
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
    fn: async (
      { microLearningId }: { microLearningId: string },
      executionContext
    ) => {
      const success = await handlers.handleEndExpiredMicroLearning(
        { microLearningId },
        globalContext,
        executionContext
      )
      return { success }
    },
  })

  const endExpiredGroupActivity = hatchet.task({
    name: 'end-expired-group-activities',
    retries: 3,
    fn: async (
      { groupActivityId }: { groupActivityId: string },
      executionContext
    ) => {
      const success = await handlers.handleEndExpiredGroupActivity(
        { groupActivityId },
        globalContext,
        executionContext
      )
      return { success }
    },
  })
  // #endregion

  // ! LIVE QUIZ RESULT AGGREGATION TASKS
  // #region
  const aggregateLiveQuizBlockResultsStandard = hatchet.task({
    name: 'aggregate-block-closure-standard',
    retries: 3,
    defaultPriority: Priority.MEDIUM,
    fn: async (
      {
        liveQuizId,
        blockId,
      }: {
        liveQuizId: string
        blockId: number
      },
      executionContext
    ) => {
      const success =
        await handlers.handleStandardLiveQuizBlockClosureAggregation(
          { liveQuizId, blockId },
          globalContext,
          executionContext
        )
      return { success }
    },
  })

  const aggregateLiveQuizBlockResultsAssessment = hatchet.task({
    name: 'aggregate-block-closure-assessment',
    retries: 3,
    defaultPriority: Priority.MEDIUM,
    fn: async (
      {
        liveQuizId,
        blockId,
      }: {
        liveQuizId: string
        blockId: number
      },
      executionContext
    ) => {
      const success =
        await handlers.handleAssessmentLiveQuizBlockClosureAggregation(
          { liveQuizId, blockId },
          globalContext,
          executionContext
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
      '0 0 * * *', // running daily at midnight (UTC)
    ],
    fn: async (_, executionContext) => {
      const success = await handlers.handleUpdateGroupAverageScores(
        {},
        globalContext,
        executionContext
      )
      return { success }
    },
  })

  const runningRandomGroupAssignments = hatchet.task({
    name: 'running-random-group-assignments',
    retries: 3,
    onCrons: [
      '0 0 * * *', // running daily at midnight (UTC)
    ],
    fn: async (_, executionContext) => {
      const success = await handlers.handleRunningRandomGroupAssignments(
        {},
        globalContext,
        executionContext
      )
      return { success }
    },
  })

  const finalRandomGroupAssignments = hatchet.task({
    name: 'final-random-group-assignments',
    retries: 3,
    onCrons: [
      '0 0 * * *', // running daily at midnight (UTC)
    ],
    fn: async (_, executionContext) => {
      const success = await handlers.handleFinalRandomGroupAssignments(
        {},
        globalContext,
        executionContext
      )
      return { success }
    },
  })

  const updateWeeklyTimelineEntries = hatchet.task({
    name: 'update-weekly-timeline-entries',
    retries: 3,
    onCrons: [
      '0 0 * * *', // running daily at midnight (UTC)
    ],
    fn: async (_, executionContext) => {
      const success = await handlers.handleUpdateWeeklyTimelineEntries(
        {},
        globalContext,
        executionContext
      )
      return { success }
    },
  })

  // ? temporarily paused workflow, since the functionality is currently not available and needs fixing
  const sendPushNotifications = hatchet.task({
    name: 'send-push-notifications',
    // retries: 3,
    // onCrons: ['*/5 * * * *'], // runs every 5 minutes
    fn: async (_, executionContext) => {
      // TODO: clean implementation
      return { success: true }
      // const success = await handlers.handleSendPushNotifications({}, globalContext, executionContext)
      // return { success }
    },
  })
  // #endregion

  return {
    adaptiveEmpiricalValidation,
    adaptiveCalibrationExport,
    adaptiveCalibrationExportCleanup,
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
    aggregateLiveQuizBlockResultsStandard,
    aggregateLiveQuizBlockResultsAssessment,
    createAuditLogEntry,
  }
}

// Export the inferred type of the tasks dictionary so other packages can import it
export type PreparedHatchetTasks = ReturnType<typeof prepareHatchetTasks>
