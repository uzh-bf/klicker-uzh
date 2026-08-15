import {
  ConcurrencyLimitStrategy,
  Priority,
  type Context,
  type HatchetClient,
} from '@hatchet-dev/typescript-sdk'
import { prisma } from '@klicker-uzh/prisma'
import type {
  BuildKBGraphInput,
  DeleteKBResourceInput,
  HatchetHandlers,
  IngestKBResourceInput,
} from '@klicker-uzh/types'
import type EventEmitter from 'events'
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

export * from './client.js'
export * from './kbGraphIngestion.js'
export * from './kbGraphIngestionApi.js'
export * from './kbIngestion.js'
export * from './kbIngestionApi.js'
export * from './kbMaintenance.js'

export type { HatchetHandlers } from '@klicker-uzh/types'

export function prepareHatchetTasks({
  hatchet,
  pubSub,
  emitter,
  redisExec,
  redisAssessmentExec,
  redisCache,
  handlers,
  getKBGraphTerminalResult,
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
  settleKBGraphTerminalResult: (input: {
    buildId: string
    result: unknown
    finishedAt: Date
    allowLateSuccess?: boolean
  }) => Promise<'SETTLED' | 'RELEASED' | 'NEEDS_HUMAN_REVIEW' | 'DUPLICATE'>
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

  const monitorKBIngestions = hatchet.task({
    name: 'monitor-kb-ingestions',
    onCrons: ['* * * * *'],
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
    fn: async (_, ctx) => maintainKBResources({ prisma, logger: ctx.logger }),
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
    createAuditLogEntry,
  }
}

// Export the inferred type of the tasks dictionary so other packages can import it
export type PreparedHatchetTasks = ReturnType<typeof prepareHatchetTasks>
