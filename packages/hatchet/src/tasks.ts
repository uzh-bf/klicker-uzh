import { Priority, type HatchetClient } from '@hatchet-dev/typescript-sdk'
import { ConcurrencyLimitStrategy } from '@hatchet-dev/typescript-sdk/protoc/v1/workflows.js'
import { prisma } from '@klicker-uzh/prisma'
import {
  ANALYTICS_SCRIPTS,
  HATCHET_EVENTS,
  type HatchetHandlers,
  type RecomputeLearningAnalyticsInput,
} from '@klicker-uzh/types'
import type EventEmitter from 'events'
import type { PubSub } from 'graphql-yoga'
import type { Redis } from 'ioredis'

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

  // Learning-analytics DAG. 15 sub-tasks, 12 parallel at the root of the graph,
  // 3 join nodes that depend on earlier outputs. Replaces the former single
  // serial 15-script shell-out.
  //
  // Per-script tasks invoke handlers.handleRunAnalyticsScript, which spawns
  // one `uv run python -m <module>` subprocess. Env vars (ANALYTICS_MODE /
  // ANALYTICS_COURSE_IDS / ANALYTICS_WINDOW_SINCE) are derived from the
  // workflow input in the handler — same shape as before, just sent once per
  // task rather than once per pipeline.
  //
  // Concurrency group: CEL expression scopes the lock to per-course when a
  // courseId is present (finalize), otherwise to 'global' (weekly cron +
  // admin manual recompute). maxRuns=1 serialises same-scope runs.
  const recomputeLearningAnalytics =
    hatchet.workflow<RecomputeLearningAnalyticsInput>({
      name: 'recompute-learning-analytics',
      onCrons: [
        '0 2 * * 1', // Mondays at 02:00 UTC — after weekend data settles (incremental)
      ],
      onEvents: [
        HATCHET_EVENTS.courseEnded, // emitted by scan-ended-courses — triggers finalize for one course
        HATCHET_EVENTS.adminRecomputeAnalytics, // manual dispatch via Hatchet dashboard for now
      ],
      concurrency: {
        expression: "has(input.courseId) ? input.courseId : 'global'",
        maxRuns: 1,
        // Freshness-first: a newer cron/event supersedes a still-running older
        // run in the same scope. Finalize cancelling in-progress weekly is fine
        // because the weekly rerun will pick up the finalised state on its next
        // wake; weekly cancelling an earlier weekly is the intended semantics.
        limitStrategy: ConcurrencyLimitStrategy.CANCEL_IN_PROGRESS,
      },
      taskDefaults: {
        // Per-task defaults: most scripts complete in under 10 minutes. The
        // heaviest (0, 1, 8, 9 in full-history mode) override below.
        executionTimeout: '30m',
        retries: 2,
      },
    })

  // Returns void on success; throws on any subprocess failure so Hatchet's
  // `taskDefaults.retries` fire and child tasks that gate on `parents: [...]`
  // correctly see an upstream failure. Wrapping the handler's result in
  // `{ success: false }` used to make every failure look like a success to the
  // DAG engine.
  const makeScriptTaskFn =
    (scriptModule: string) =>
    async (input: RecomputeLearningAnalyticsInput, ctx: any) => {
      await handlers.handleRunAnalyticsScript(
        { ...(input ?? {}), scriptModule },
        globalContext,
        ctx
      )
    }

  // Leaves of the DAG — no analytics-pipeline dependencies. Each reads raw
  // event/course tables; parallelism is bounded only by worker count and DB
  // connection pool.
  const taskS0 = recomputeLearningAnalytics.task({
    name: 's0-participant-analytics',
    executionTimeout: '60m', // window-iterating
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s0_participant),
  })
  const taskS2 = recomputeLearningAnalytics.task({
    name: 's2-course-heatmap',
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s2_course_heatmap),
  })
  const taskS3 = recomputeLearningAnalytics.task({
    name: 's3-instance-activity-perf',
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s3_instance_activity),
  })
  const taskS4 = recomputeLearningAnalytics.task({
    name: 's4-participant-perf',
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s4_participant_perf),
  })
  const taskS5 = recomputeLearningAnalytics.task({
    name: 's5-participant-course-analytics',
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s5_participant_course),
  })
  const taskS6 = recomputeLearningAnalytics.task({
    name: 's6-activity-progress',
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s6_activity_progress),
  })
  const taskS7 = recomputeLearningAnalytics.task({
    name: 's7-participant-activity-perf',
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s7_participant_activity),
  })
  const taskS8 = recomputeLearningAnalytics.task({
    name: 's8-chat-analytics',
    executionTimeout: '60m', // window-iterating
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s8_chat),
  })
  const taskS9 = recomputeLearningAnalytics.task({
    name: 's9-aggregated-chatbot-analytics',
    executionTimeout: '60m', // window-iterating
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s9_chatbot),
  })
  const taskS10 = recomputeLearningAnalytics.task({
    name: 's10-chat-topic-clustering',
    // Clustering is expensive and usually deterministically fails when it
    // fails (OOM, model load, etc.). Retries just prolong the pipeline.
    retries: 0,
    executionTimeout: '60m',
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s10_clustering),
  })
  const taskS13 = recomputeLearningAnalytics.task({
    name: 's13-platform-semester-analytics',
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s13_platform),
  })
  const taskS14 = recomputeLearningAnalytics.task({
    name: 's14-live-quiz-assessment-analytics',
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s14_live_quiz),
  })

  // Join nodes — per §2.2 dependency graph.
  const taskS1 = recomputeLearningAnalytics.task({
    name: 's1-aggregated-analytics',
    executionTimeout: '60m', // window-iterating
    parents: [taskS0],
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s1_aggregated),
  })
  const taskS11 = recomputeLearningAnalytics.task({
    name: 's11-chat-quiz-correlation',
    parents: [taskS4, taskS8],
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s11_chat_quiz),
  })
  // Full fan-in: every analytics-pipeline task must succeed before s99 flips
  // Course.areAnalyticsValid. "Valid" means "every script ran" — a leaf that
  // threw (which now actually propagates, see handleRunAnalyticsScript) is an
  // upstream failure and Hatchet will skip s99.
  recomputeLearningAnalytics.task({
    name: 's99-mark-analytics-valid',
    parents: [
      taskS0,
      taskS1,
      taskS2,
      taskS3,
      taskS4,
      taskS5,
      taskS6,
      taskS7,
      taskS8,
      taskS9,
      taskS10,
      taskS11,
      taskS13,
      taskS14,
    ],
    fn: makeScriptTaskFn(ANALYTICS_SCRIPTS.s99_validity),
  })

  const scanEndedCourses = hatchet.task({
    name: 'scan-ended-courses',
    retries: 3,
    onCrons: [
      // Daily at 01:00 UTC — runs before the Monday 02:00 incremental recompute
      // so any courses that crossed into FINALIZING in the past day are picked
      // up, finalised, and then skipped by the weekly cron.
      '0 1 * * *',
    ],
    fn: async (_input, executionContext) => {
      const graceDays = Number.parseInt(
        process.env.ANALYTICS_FINALIZE_GRACE_DAYS ?? '7',
        10
      )
      const effectiveGrace =
        Number.isFinite(graceDays) && graceDays >= 0 ? graceDays : 7
      const cutoff = new Date(Date.now() - effectiveGrace * 24 * 60 * 60 * 1000)

      const candidates = await prisma.course.findMany({
        where: {
          analyticsFinalizedAt: null,
          OR: [{ endDate: { lte: cutoff } }, { isArchived: true }],
        },
        select: { id: true },
      })

      await executionContext.logger.info(
        `[scanEndedCourses] graceDays=${effectiveGrace} cutoff=${cutoff.toISOString()} candidates=${candidates.length}`
      )

      // Day-bucketed idempotency key — a scanner retry inside the same UTC
      // day reuses the key and Hatchet de-duplicates the emission. Workflow
      // concurrency still cancels an in-progress older run on a new key, but
      // the common case (CI retry, manual re-trigger) no longer costs a
      // scheduling round trip per duplicate.
      const today = new Date().toISOString().slice(0, 10)
      await Promise.all(
        candidates.map(({ id }) =>
          hatchet.events.push(
            HATCHET_EVENTS.courseEnded,
            {
              mode: 'finalize',
              courseId: id,
            } satisfies RecomputeLearningAnalyticsInput,
            {
              additionalMetadata: { idempotencyKey: `finalize-${id}-${today}` },
            }
          )
        )
      )

      return { success: true, emitted: candidates.length }
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
    createAuditLogEntry,
    recomputeLearningAnalytics,
    scanEndedCourses,
  }
}

// Export the inferred type of the tasks dictionary so other packages can import it
export type PreparedHatchetTasks = ReturnType<typeof prepareHatchetTasks>
