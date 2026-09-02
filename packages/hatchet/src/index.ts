import {
  ConcurrencyLimitStrategy,
  type Context,
  type HatchetClient,
  Priority,
} from '@hatchet-dev/typescript-sdk'
import type { AppLogger } from '@klicker-uzh/logging/node'
import { prisma } from '@klicker-uzh/prisma'
import type {
  HatchetHandlers,
  HatchetLoggingContext,
  PreparedHatchetTasks,
} from '@klicker-uzh/types'
import type EventEmitter from 'node:events'
import type { PubSub } from 'graphql-yoga'
import type { Redis } from 'ioredis'
import { type LoggableHatchetInput, withHatchetTaskLogging } from './logging.js'

export type { HatchetHandlers, PreparedHatchetTasks } from '@klicker-uzh/types'
export * from './client.js'
export * from './logging.js'

type AuditLogMessage = Record<
  string,
  string | HatchetLoggingContext | undefined
> & {
  correlationId?: string
  info: string
  loggingContext?: HatchetLoggingContext
}

type AuditLogInput = AuditLogMessage | { message: AuditLogMessage }

function isAuditLogMessage(input: unknown): input is AuditLogMessage {
  return (
    input !== null &&
    typeof input === 'object' &&
    !Array.isArray(input) &&
    typeof (input as { info?: unknown }).info === 'string'
  )
}
export function prepareHatchetTasks({
  hatchet,
  pubSub,
  emitter,
  redisExec,
  redisAssessmentExec,
  redisCache,
  handlers,
  logger,
}: {
  hatchet: HatchetClient
  pubSub: PubSub<any>
  emitter: EventEmitter
  redisExec: Redis
  redisAssessmentExec: Redis
  redisCache?: Redis
  handlers: HatchetHandlers
  logger?: AppLogger
}) {
  let preparedTasks: PreparedHatchetTasks | undefined

  function withTaskLogging<TInput extends LoggableHatchetInput, TOutput>(
    taskName: string,
    handler: (
      input: TInput,
      context: Context<TInput>
    ) => Promise<TOutput> | TOutput
  ) {
    return logger
      ? withHatchetTaskLogging<TInput, TOutput, Context<TInput>>({
          logger,
          taskName,
          handler,
        })
      : handler
  }
  const globalContext = {
    hatchet,
    pubSub,
    emitter,
    redisExec,
    redisAssessmentExec,
    redisCache,
    prisma,
    logger,
    get tasks() {
      if (!preparedTasks) {
        throw new Error(
          'Hatchet tasks are not available until prepareHatchetTasks completes.'
        )
      }
      return preparedTasks
    },
  }

  // ! AUDIT LOGGING
  // #region
  const createAuditLogEntry = hatchet.task({
    name: 'create-audit-log-entry',
    retries: 3,
    defaultPriority: Priority.LOW,
    onEvents: ['create-audit-log-entry'],
    fn: logger
      ? withHatchetTaskLogging({
          logger,
          taskName: 'create-audit-log-entry',
          handler: createAuditLogEntryHandler,
        })
      : createAuditLogEntryHandler,
  })

  function createAuditLogEntryHandler(
    input: AuditLogInput,
    ctx: Context<AuditLogInput>
  ) {
    // GraphQL task calls use the declared envelope; event producers send the
    // audit message directly.
    const messageInput =
      input !== null && typeof input === 'object'
        ? (input as { message?: unknown }).message
        : undefined
    let message: AuditLogMessage
    if (isAuditLogMessage(messageInput)) {
      message = messageInput
    } else if (isAuditLogMessage(input)) {
      message = input
    } else {
      throw new Error('Invalid audit log message input')
    }
    const { info, ...args } = message
    delete args.loggingContext
    delete args.correlationId
    const correlationId =
      message.correlationId ?? message.loggingContext?.correlationId

    // TODO: send the message to the actual audit log service with the correlation ID as a key?
    if (logger) {
      logger.info(
        {
          event: 'audit.entry.received',
          ...(correlationId ? { correlationId } : {}),
          ...args,
        },
        info
      )
    } else {
      ctx.logger.info(`Audit log entry: ${info}`, args)
    }
    return { success: true }
  }
  // #endregion

  // ! ACTIVITY PUBLICATION TASKS
  // #region
  const publishScheduledMicroLearning = hatchet.task({
    name: 'publish-scheduled-microlearning',
    retries: 3,
    fn: withTaskLogging(
      'publish-scheduled-microlearning',
      async (
        { microLearningId }: { microLearningId: string } & LoggableHatchetInput,
        executionContext
      ) => {
        const success = await handlers.handlePublishScheduledMicroLearning(
          { microLearningId },
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })

  const publishScheduledGroupActivity = hatchet.task({
    name: 'publish-scheduled-group-activity',
    retries: 3,
    fn: withTaskLogging(
      'publish-scheduled-group-activity',
      async (
        { groupActivityId }: { groupActivityId: string } & LoggableHatchetInput,
        executionContext
      ) => {
        const success = await handlers.handlePublishScheduledGroupActivity(
          { groupActivityId },
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })

  const publishScheduledPracticeQuiz = hatchet.task({
    name: 'publish-scheduled-practice-quiz',
    retries: 3,
    fn: withTaskLogging(
      'publish-scheduled-practice-quiz',
      async (
        { practiceQuizId }: { practiceQuizId: string } & LoggableHatchetInput,
        executionContext
      ) => {
        const success = await handlers.handlePublishScheduledPracticeQuiz(
          { practiceQuizId },
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })

  const publishScheduledLiveQuiz = hatchet.task({
    name: 'publish-scheduled-live-quiz',
    retries: 3,
    fn: withTaskLogging(
      'publish-scheduled-live-quiz',
      async (
        { liveQuizId }: { liveQuizId: string } & LoggableHatchetInput,
        executionContext
      ) => {
        const success = await handlers.handlePublishScheduledLiveQuiz(
          { liveQuizId },
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })
  // #endregion

  // ! ACTIVITY ENDING TASKS
  // #region
  const endExpiredMicroLearning = hatchet.task({
    name: 'end-expired-micro-learnings',
    retries: 3,
    fn: withTaskLogging(
      'end-expired-micro-learnings',
      async (
        { microLearningId }: { microLearningId: string } & LoggableHatchetInput,
        executionContext
      ) => {
        const success = await handlers.handleEndExpiredMicroLearning(
          { microLearningId },
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })

  const endExpiredGroupActivity = hatchet.task({
    name: 'end-expired-group-activities',
    retries: 3,
    fn: withTaskLogging(
      'end-expired-group-activities',
      async (
        { groupActivityId }: { groupActivityId: string } & LoggableHatchetInput,
        executionContext
      ) => {
        const success = await handlers.handleEndExpiredGroupActivity(
          { groupActivityId },
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })
  // #endregion

  // ! LIVE QUIZ RESULT AGGREGATION TASKS
  // #region
  const aggregateLiveQuizBlockResultsStandard = hatchet.task({
    name: 'aggregate-block-closure-standard',
    retries: 3,
    defaultPriority: Priority.MEDIUM,
    fn: withTaskLogging(
      'aggregate-block-closure-standard',
      async (
        {
          liveQuizId,
          blockId,
        }: {
          liveQuizId: string
          blockId: number
        } & LoggableHatchetInput,
        executionContext
      ) => {
        const success =
          await handlers.handleStandardLiveQuizBlockClosureAggregation(
            { liveQuizId, blockId },
            globalContext,
            executionContext
          )
        return { success }
      }
    ),
  })

  const aggregateLiveQuizBlockResultsAssessment = hatchet.task({
    name: 'aggregate-block-closure-assessment',
    retries: 3,
    defaultPriority: Priority.MEDIUM,
    fn: withTaskLogging(
      'aggregate-block-closure-assessment',
      async (
        {
          liveQuizId,
          blockId,
        }: {
          liveQuizId: string
          blockId: number
        } & LoggableHatchetInput,
        executionContext
      ) => {
        const success =
          await handlers.handleAssessmentLiveQuizBlockClosureAggregation(
            { liveQuizId, blockId },
            globalContext,
            executionContext
          )
        return { success }
      }
    ),
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
    fn: withTaskLogging(
      'update-group-average-scores',
      async (_input: LoggableHatchetInput, executionContext) => {
        const success = await handlers.handleUpdateGroupAverageScores(
          {},
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })

  const runningRandomGroupAssignments = hatchet.task({
    name: 'running-random-group-assignments',
    retries: 3,
    onCrons: [
      '0 0 * * *', // running daily at midnight (UTC)
    ],
    fn: withTaskLogging(
      'running-random-group-assignments',
      async (_input: LoggableHatchetInput, executionContext) => {
        const success = await handlers.handleRunningRandomGroupAssignments(
          {},
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })

  const finalRandomGroupAssignments = hatchet.task({
    name: 'final-random-group-assignments',
    retries: 3,
    onCrons: [
      '0 0 * * *', // running daily at midnight (UTC)
    ],
    fn: withTaskLogging(
      'final-random-group-assignments',
      async (_input: LoggableHatchetInput, executionContext) => {
        const success = await handlers.handleFinalRandomGroupAssignments(
          {},
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })

  const updateWeeklyTimelineEntries = hatchet.task({
    name: 'update-weekly-timeline-entries',
    retries: 3,
    onCrons: [
      '0 0 * * *', // running daily at midnight (UTC)
    ],
    fn: withTaskLogging(
      'update-weekly-timeline-entries',
      async (_input: LoggableHatchetInput, executionContext) => {
        const success = await handlers.handleUpdateWeeklyTimelineEntries(
          {},
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })

  // ? temporarily paused workflow, since the functionality is currently not available and needs fixing
  const sendPushNotifications = hatchet.task({
    name: 'send-push-notifications',
    // retries: 3,
    // onCrons: ['*/5 * * * *'], // runs every 5 minutes
    fn: withTaskLogging(
      'send-push-notifications',
      async (_input: LoggableHatchetInput, _executionContext) => {
        // TODO: clean implementation
        return { success: true }
        // const success = await handlers.handleSendPushNotifications({}, globalContext, executionContext)
        // return { success }
      }
    ),
  })
  // #endregion

  const processCourseDuplication = hatchet.task({
    name: 'process-course-duplication',
    retries: 3,
    backoff: { factor: 60, maxSeconds: 120 },
    executionTimeout: '30m',
    scheduleTimeout: '60m',
    defaultPriority: Priority.LOW,
    concurrency: {
      expression: "'course-duplication'",
      maxRuns: 1,
      limitStrategy: ConcurrencyLimitStrategy.GROUP_ROUND_ROBIN,
    },
    onEvents: ['process-course-duplication'],
    fn: withTaskLogging(
      'process-course-duplication',
      async (
        { jobId, loggingContext }: { jobId: string } & LoggableHatchetInput,
        executionContext
      ) => {
        const success = await handlers.handleProcessCourseDuplication(
          { jobId, loggingContext },
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })

  const sweepStaleCourseDuplications = hatchet.task({
    name: 'sweep-stale-course-duplications',
    retries: 0,
    onCrons: [
      '*/5 * * * *', // every 5 minutes (UTC)
    ],
    fn: withTaskLogging(
      'sweep-stale-course-duplications',
      async (_input: LoggableHatchetInput, executionContext) => {
        const success = await handlers.handleSweepStaleCourseDuplications(
          {},
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })

  const tasks = {
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
    processCourseDuplication,
    sweepStaleCourseDuplications,
  }

  preparedTasks = tasks

  return tasks
}
