import type EventEmitter from 'node:events'
import {
  ConcurrencyLimitStrategy,
  type Context,
  type HatchetClient,
  Priority,
} from '@hatchet-dev/typescript-sdk'
import { prisma } from '@klicker-uzh/prisma'
import type {
  BuildKBGraphInput,
  CourseDeletionEvent,
  DeleteKBResourceInput,
  HatchetHandlers,
  IngestKBResourceInput,
  PreparedHatchetTasks,
} from '@klicker-uzh/types'
import type { PubSub } from 'graphql-yoga'
import type { Redis } from 'ioredis'
import {
  dispatchKBGraphBuild,
  markKBGraphBuildDispatchFailed,
  monitorActiveKBGraphBuilds,
} from './kbGraphIngestion.js'
import {
  dispatchKBDeletion,
  dispatchKBIngestion,
  failKBIngestionDispatch,
  monitorActiveKBIngestions,
  retainFailedKBDeletionDispatch,
} from './kbIngestion.js'
import { maintainKBResources } from './kbMaintenance.js'
import { type LoggableHatchetInput, withHatchetTaskLogging } from './logging.js'

export type { HatchetHandlers, PreparedHatchetTasks } from '@klicker-uzh/types'
export type { AuditLogInput, AuditLogMessage } from './auditLogging.js'
export * from './client.js'
export * from './kbGraphIngestion.js'
export * from './kbGraphIngestionApi.js'
export * from './kbIngestion.js'
export * from './kbIngestionApi.js'
export * from './kbMaintenance.js'
export * from './logging.js'
export * from './worker-runtime.js'
export function prepareHatchetTasks({
  hatchet,
  pubSub,
  emitter,
  redisExec,
  redisAssessmentExec,
  redisCache,
  handlers,
  getKBGraphTerminalResult,
  kbIngestionDispatchEnabled = true,
  kbGraphDispatchEnabled = true,
  settleKBGraphTerminalResult,
}: {
  hatchet: HatchetClient
  pubSub: PubSub<any>
  emitter: EventEmitter
  redisExec: Redis
  redisAssessmentExec: Redis
  redisCache?: Redis
  handlers: HatchetHandlers
  getKBGraphTerminalResult: (runId: string) => Promise<unknown>
  kbIngestionDispatchEnabled?: boolean
  kbGraphDispatchEnabled?: boolean
  settleKBGraphTerminalResult: (input: {
    buildId: string
    result: unknown
    finishedAt: Date
    allowLateSuccess?: boolean
  }) => Promise<'SETTLED' | 'RELEASED' | 'NEEDS_HUMAN_REVIEW' | 'DUPLICATE'>
}) {
  let preparedTasks: PreparedHatchetTasks | undefined

  function withTaskLogging<TInput extends LoggableHatchetInput, TOutput>(
    taskName: string,
    handler: (
      input: TInput,
      context: Context<TInput>
    ) => Promise<TOutput> | TOutput
  ) {
    return withHatchetTaskLogging<TInput, TOutput, Context<TInput>>({
      taskName,
      handler,
    })
  }
  const globalContext = {
    hatchet,
    pubSub,
    emitter,
    redisExec,
    redisAssessmentExec,
    redisCache,
    prisma,
    get tasks() {
      if (!preparedTasks) {
        throw new Error(
          'Hatchet tasks are not available until prepareHatchetTasks completes.'
        )
      }
      return preparedTasks
    },
  }

  // ! ASSESSMENT AUDIT DELIVERY
  // #region
  const dispatchAssessmentAuditOutbox = hatchet.task({
    name: 'dispatch-assessment-audit-outbox',
    retries: 0,
    onCrons: ['* * * * *'],
    fn: async (_, executionContext) => {
      const success = await handlers.handleDispatchAssessmentAuditOutbox(
        {},
        globalContext,
        executionContext
      )
      return { success }
    },
  })

  const monitorAssessmentAudit = hatchet.task({
    name: 'monitor-assessment-audit',
    retries: 0,
    onCrons: ['* * * * *'],
    fn: async (_, executionContext) => {
      const success = await handlers.handleMonitorAssessmentAudit(
        {},
        globalContext,
        executionContext
      )
      return { success }
    },
  })

  const renewAssessmentAuditMediaPolicies = hatchet.task({
    name: 'renew-assessment-audit-media-policies',
    retries: 3,
    onCrons: ['17 1 * * *'],
    fn: async (_, executionContext) => {
      const success = await handlers.handleRenewAssessmentAuditMediaPolicies(
        {},
        globalContext,
        executionContext
      )
      return { success }
    },
  })
  // #endregion

  const ingestKBResourceDefinition = {
    name: 'ingest-kb-resource',
    retries: 3,
    fn: async (
      input: IngestKBResourceInput,
      ctx: Context<IngestKBResourceInput>
    ) => {
      await ctx.logger.info('KB ingestion dispatch started', {
        resourceId: input.resourceId,
        kbId: input.kbId,
        type: input.type,
      })
      await dispatchKBIngestion(input, {
        prisma,
        logger: ctx.logger,
      })
      return { success: true }
    },
    onFailure: {
      retries: 3,
      fn: async (input: IngestKBResourceInput) => {
        await failKBIngestionDispatch({ input, prisma })
      },
    },
  }
  const ingestKBResource = hatchet.task(ingestKBResourceDefinition)
  const deleteKBResourceDefinition = {
    name: 'delete-kb-resource',
    retries: 3,
    fn: async (
      input: DeleteKBResourceInput,
      ctx: Context<DeleteKBResourceInput>
    ) => {
      await ctx.logger.info('KB deletion dispatch started', {
        resourceId: input.resourceId,
        kbId: input.kbId,
      })
      await dispatchKBDeletion(input, {
        prisma,
        logger: ctx.logger,
      })
      return { success: true }
    },
    onFailure: {
      retries: 3,
      fn: async (input: DeleteKBResourceInput) => {
        await retainFailedKBDeletionDispatch({ input, prisma })
      },
    },
  }
  const deleteKBResource = hatchet.task(deleteKBResourceDefinition)

  const buildKBGraphDefinition = {
    name: 'build-kb-knowledge-graph',
    retries: 3,
    fn: async (input: BuildKBGraphInput, ctx: Context<BuildKBGraphInput>) => {
      await ctx.logger.info('KB graph build dispatch started', {
        buildId: input.buildId,
      })
      await dispatchKBGraphBuild(input, {
        prisma,
        logger: ctx.logger,
      })
      return { success: true }
    },
    onFailure: {
      retries: 3,
      fn: async (input: BuildKBGraphInput) => {
        await markKBGraphBuildDispatchFailed(input, prisma)
      },
    },
  }
  const buildKBGraph = hatchet.task(buildKBGraphDefinition)
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
        {
          liveQuizId,
          initiatedByUserId,
        }: {
          liveQuizId: string
          initiatedByUserId?: string
        } & LoggableHatchetInput,
        executionContext
      ) => {
        const success = await handlers.handlePublishScheduledLiveQuiz(
          { liveQuizId, initiatedByUserId },
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

  const monitorKBIngestions = hatchet.task({
    name: 'monitor-kb-ingestions',
    onCrons: ['*/5 * * * *'],
    concurrency: {
      expression: '"monitor-kb-ingestions"',
      maxRuns: 1,
      limitStrategy: ConcurrencyLimitStrategy.CANCEL_NEWEST,
    },
    fn: async () => monitorActiveKBIngestions({ prisma }),
  })

  const monitorKBGraphBuilds = hatchet.task({
    name: 'monitor-kb-graph-builds',
    onCrons: ['* * * * *'],
    concurrency: {
      expression: '"monitor-kb-graph-builds"',
      maxRuns: 1,
      limitStrategy: ConcurrencyLimitStrategy.CANCEL_NEWEST,
    },
    fn: async (_, ctx) =>
      monitorActiveKBGraphBuilds({
        prisma,
        logger: ctx.logger,
        getTerminalResult: getKBGraphTerminalResult,
        settleTerminalResult: settleKBGraphTerminalResult,
      }),
  })

  const maintainKBResourcesTask = hatchet.task({
    name: 'maintain-kb-resources',
    onCrons: ['*/15 * * * *'],
    concurrency: {
      expression: '"maintain-kb-resources"',
      maxRuns: 1,
      limitStrategy: ConcurrencyLimitStrategy.CANCEL_NEWEST,
    },
    fn: async (_, ctx) =>
      maintainKBResources({
        prisma,
        logger: ctx.logger,
        ingestionDispatchEnabled: kbIngestionDispatchEnabled,
        ...(kbGraphDispatchEnabled
          ? {
              enqueueKBGraphBuild: async (buildId: string) => {
                await buildKBGraph.runNoWait({ buildId })
              },
            }
          : {}),
      }),
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

  const processCourseDeletion = hatchet.task({
    name: 'process-course-deletion',
    retries: 3,
    backoff: { factor: 60, maxSeconds: 120 },
    executionTimeout: '30m',
    scheduleTimeout: '60m',
    defaultPriority: Priority.LOW,
    concurrency: {
      expression: "'course-deletion'",
      maxRuns: 1,
      limitStrategy: ConcurrencyLimitStrategy.GROUP_ROUND_ROBIN,
    },
    onEvents: ['process-course-deletion'],
    fn: withTaskLogging(
      'process-course-deletion',
      async (input: CourseDeletionEvent, executionContext) => {
        const success = await handlers.handleProcessCourseDeletion(
          input,
          globalContext,
          executionContext
        )
        return { success }
      }
    ),
  })

  const tasks = {
    dispatchAssessmentAuditOutbox,
    monitorAssessmentAudit,
    renewAssessmentAuditMediaPolicies,
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
    ingestKBResource,
    deleteKBResource,
    buildKBGraph,
    monitorKBIngestions,
    monitorKBGraphBuilds,
    maintainKBResources: maintainKBResourcesTask,
    processCourseDuplication,
    sweepStaleCourseDuplications,
    processCourseDeletion,
  }

  preparedTasks = tasks

  return tasks
}
