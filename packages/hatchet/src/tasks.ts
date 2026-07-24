import { Priority, type HatchetClient } from '@hatchet-dev/typescript-sdk'
import { prisma } from '@klicker-uzh/prisma'
import { Prisma } from '@klicker-uzh/prisma/client'
import {
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
  database = prisma,
}: {
  hatchet: HatchetClient
  pubSub: PubSub<any>
  emitter: EventEmitter
  redisExec: Redis
  redisAssessmentExec: Redis
  redisCache?: Redis
  handlers: HatchetHandlers
  database?: Pick<typeof prisma, '$queryRaw'>
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

      const candidates = await database.$queryRaw<{ id: string }[]>(
        Prisma.sql`
          WITH ended_courses AS MATERIALIZED (
            SELECT
              c.id,
              c."analyticsFinalizedAt",
              c."chatAnalyticsValidAt"
            FROM "Course" c
            WHERE (
              c."endDate" <= ${cutoff}
              OR c."isArchived" = true
            )
          ),
          dirty_chat_courses AS MATERIALIZED (
            SELECT cb."courseId"
            FROM ended_courses ended
            JOIN "Chatbot" cb ON cb."courseId" = ended.id
            JOIN "ChatUsageCredits" cuc ON cuc."chatbotId" = cb.id
            WHERE (
              cuc."disclaimerAcceptedAt" > ended."chatAnalyticsValidAt"
              OR (
                cuc."disclaimerDeclined" = true
                AND cuc."updatedAt" > ended."chatAnalyticsValidAt"
              )
              OR (
                cuc."acceptedDisclaimerId" IS DISTINCT FROM cb."disclaimerId"
                AND cb."updatedAt" > ended."chatAnalyticsValidAt"
              )
            )

            UNION

            SELECT pca."courseId"
            FROM ended_courses ended
            JOIN "ParticipantChatAnalytics" pca ON pca."courseId" = ended.id
            JOIN "Chatbot" cb ON cb.id = pca."chatbotId"
            LEFT JOIN "ChatUsageCredits" cuc
              ON cuc."participantId" = pca."participantId"
             AND cuc."chatbotId" = pca."chatbotId"
            WHERE (
              cuc."participantId" IS NULL
              OR cuc."acceptedDisclaimerId" IS DISTINCT FROM cb."disclaimerId"
              OR cuc."disclaimerDeclined" = true
            )
          )
          SELECT ended.id
          FROM ended_courses ended
          WHERE (
            ended."analyticsFinalizedAt" IS NULL
            OR ended."chatAnalyticsValidAt" IS NULL
            OR EXISTS (
              SELECT 1
              FROM dirty_chat_courses dirty
              WHERE dirty."courseId" = ended.id
            )
          )
        `
      )

      await executionContext.logger.info(
        `[scanEndedCourses] graceDays=${effectiveGrace} cutoff=${cutoff.toISOString()} candidates=${candidates.length}`
      )

      // Day-bucketed dashboard metadata makes scanner emissions identifiable.
      // It does not deduplicate events; workflow concurrency cancels an
      // in-progress older run when another event targets the same course.
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
    scanEndedCourses,
  }
}

// Export the inferred type of the tasks dictionary so other packages can import it
export type PreparedHatchetTasks = ReturnType<typeof prepareHatchetTasks>
