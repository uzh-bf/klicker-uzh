import { randomUUID } from 'node:crypto'
import {
  ANALYTICS_ENGINE_CONTRACT_VERSION,
  calendarDateSchema,
  courseWorkflowInputSchema,
  rfc3339DateTimeSchema,
  type CourseWorkflowMode,
} from '@klicker-uzh/analytics-engine-contract'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  HatchetHandlers,
  LearningAnalyticsBatchControlInput,
  LearningAnalyticsBatchDeadlineInput,
  LearningAnalyticsBatchDeadlineOutput,
  LearningAnalyticsBatchSelectionOutput,
  LearningAnalyticsCourseCompletionInput,
  LearningAnalyticsCourseControlInput,
  LearningAnalyticsCourseControlOutput,
  LearningAnalyticsCourseStartOutput,
} from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import { v5 as uuidV5, validate as uuidValidate } from 'uuid'
import type { ContextWithUser } from '../lib/context.js'
import { lockLearningAnalyticsCourseMutation } from '../lib/learningAnalyticsLocks.js'

const ANALYTICS_TIME_ZONE = 'Europe/Zurich'
const DAILY_BATCH_NAMESPACE = '72695e3d-8c60-4db3-bef1-b995d55b283b'
const FIRST_UUID = '00000000-0000-0000-0000-000000000000'
const SELECTOR_PAGE_SIZE = 250
const FINALIZATION_GRACE_DAYS = 7
const MAX_IN_FLIGHT_COURSES = 500

interface BatchClock {
  localDate: string
  localHour: number
  localMinute: number
  stopSpawningAt: Date
  hardDeadlineAt: Date
}

interface SelectedCourseRow {
  id: string
  isLearningAnalyticsEnabled: boolean
  isArchived: boolean
  areAnalyticsValid: boolean
  analyticsLastComputedAt: Date | null
  analyticsFinalizedAt: Date | null
  endDate: Date
  hasDirtyLearningAnalyticsChoice: boolean
}

function coordinatorDisabledError(): GraphQLError {
  return new GraphQLError('LEARNING_ANALYTICS_COORDINATOR_DISABLED', {
    extensions: { code: 'LEARNING_ANALYTICS_COORDINATOR_DISABLED' },
  })
}

export function isLearningAnalyticsCoordinatorEnabled(): boolean {
  return process.env.LEARNING_ANALYTICS_COORDINATOR_ENABLED === 'true'
}

function requireInFlightLimit(): number {
  const value = Number.parseInt(
    process.env.LEARNING_ANALYTICS_BATCH_IN_FLIGHT_LIMIT ?? '',
    10
  )
  if (!Number.isInteger(value) || value < 1 || value > MAX_IN_FLIGHT_COURSES) {
    throw new Error(
      `LEARNING_ANALYTICS_BATCH_IN_FLIGHT_LIMIT must be between 1 and ${MAX_IN_FLIGHT_COURSES}`
    )
  }
  return value
}

function requireValidBatchInput(
  input: LearningAnalyticsBatchControlInput
): void {
  if (!uuidValidate(input.runId)) {
    throw new Error('Invalid learning-analytics batch run ID')
  }
  calendarDateSchema.parse(input.batchDate)
  rfc3339DateTimeSchema.parse(input.stopSpawningAt)
  rfc3339DateTimeSchema.parse(input.hardDeadlineAt)
  if (
    new Date(input.stopSpawningAt).valueOf() >=
    new Date(input.hardDeadlineAt).valueOf()
  ) {
    throw new Error('Learning-analytics deadlines are out of order')
  }
  if (
    !Number.isInteger(input.inFlightLimit) ||
    input.inFlightLimit < 1 ||
    input.inFlightLimit > MAX_IN_FLIGHT_COURSES
  ) {
    throw new Error('Invalid learning-analytics in-flight limit')
  }
  if (typeof input.includePlatform !== 'boolean') {
    throw new Error('Invalid learning-analytics platform selection')
  }
  if (input.selection === 'explicit-full') {
    if (
      !Array.isArray(input.explicitCourseIds) ||
      input.explicitCourseIds.length === 0
    ) {
      throw new Error('Explicit analytics batches require at least one course')
    }
    if (!input.explicitCourseIds.every((id) => uuidValidate(id))) {
      throw new Error('Explicit analytics batches require valid course IDs')
    }
  } else if (input.selection !== 'nightly' || input.explicitCourseIds) {
    throw new Error('Invalid learning-analytics batch selection')
  }
}

async function readBatchClock(
  prisma: Pick<DB.PrismaClient, '$queryRaw'>,
  schedule: 'manual' | 'nightly'
): Promise<BatchClock> {
  const rows = await prisma.$queryRaw<BatchClock[]>(DB.Prisma.sql`
    WITH clock AS (
      SELECT
        clock_timestamp() AS now,
        clock_timestamp() AT TIME ZONE ${ANALYTICS_TIME_ZONE} AS local_now
    ), deadlines AS (
      SELECT
        now,
        local_now,
        CASE
          WHEN ${schedule} = 'nightly'
            THEN date_trunc('day', local_now) + interval '5 hours 45 minutes'
          ELSE local_now + interval '5 hours 15 minutes'
        END AS local_stop,
        CASE
          WHEN ${schedule} = 'nightly'
            THEN date_trunc('day', local_now) + interval '6 hours'
          ELSE local_now + interval '5 hours 30 minutes'
        END AS local_hard
      FROM clock
    )
    SELECT
      to_char(local_now, 'YYYY-MM-DD') AS "localDate",
      extract(hour FROM local_now)::integer AS "localHour",
      extract(minute FROM local_now)::integer AS "localMinute",
      local_stop AT TIME ZONE ${ANALYTICS_TIME_ZONE} AS "stopSpawningAt",
      local_hard AT TIME ZONE ${ANALYTICS_TIME_ZONE} AS "hardDeadlineAt"
    FROM deadlines
  `)
  const clock = rows[0]
  if (!clock) throw new Error('PostgreSQL did not return an analytics clock')
  return clock
}

function buildBatchInput({
  clock,
  selection,
  explicitCourseIds,
}: {
  clock: BatchClock
  selection: LearningAnalyticsBatchControlInput['selection']
  explicitCourseIds?: string[]
}): LearningAnalyticsBatchControlInput {
  const runId =
    selection === 'nightly'
      ? uuidV5(
          `learning-analytics-nightly:${clock.localDate}`,
          DAILY_BATCH_NAMESPACE
        )
      : randomUUID()
  return {
    runId,
    batchDate: clock.localDate,
    selection,
    ...(explicitCourseIds ? { explicitCourseIds } : {}),
    includePlatform: true,
    inFlightLimit: requireInFlightLimit(),
    stopSpawningAt: clock.stopSpawningAt.toISOString(),
    hardDeadlineAt: clock.hardDeadlineAt.toISOString(),
  }
}

export async function prepareScheduledLearningAnalyticsBatch(
  prisma: Pick<DB.PrismaClient, '$queryRaw'>
): Promise<LearningAnalyticsBatchControlInput | null> {
  if (!isLearningAnalyticsCoordinatorEnabled()) return null

  const clock = await readBatchClock(prisma, 'nightly')
  if (clock.localHour !== 0 || clock.localMinute !== 30) return null
  return buildBatchInput({ clock, selection: 'nightly' })
}

export async function getLearningAnalyticsBatchDeadline(
  input: LearningAnalyticsBatchDeadlineInput,
  prisma: Pick<DB.PrismaClient, '$queryRaw'>
): Promise<LearningAnalyticsBatchDeadlineOutput> {
  const hardDeadlineAtValue = rfc3339DateTimeSchema.parse(input.hardDeadlineAt)
  const hardDeadlineAt = new Date(hardDeadlineAtValue)
  const rows = await prisma.$queryRaw<Array<{ remainingSeconds: number }>>(
    DB.Prisma.sql`
      WITH clock AS (
        SELECT clock_timestamp() AS now
      )
      SELECT CASE
        WHEN now < ${hardDeadlineAt}
          THEN GREATEST(
            1,
            CEIL(EXTRACT(EPOCH FROM (${hardDeadlineAt} - now)))::integer
          )
        ELSE 0
      END AS "remainingSeconds"
      FROM clock
    `
  )
  const rawRemainingSeconds = rows[0]?.remainingSeconds
  const remainingSeconds = Number(rawRemainingSeconds)
  if (
    rawRemainingSeconds === null ||
    rawRemainingSeconds === undefined ||
    !Number.isSafeInteger(remainingSeconds) ||
    remainingSeconds < 0
  ) {
    throw new Error('PostgreSQL returned an invalid analytics deadline')
  }
  return { remainingSeconds }
}

function isExplicitCourseSelection(
  input: LearningAnalyticsBatchControlInput
): input is LearningAnalyticsBatchControlInput & {
  explicitCourseIds: string[]
} {
  return input.selection === 'explicit-full'
}

function courseMode(
  row: SelectedCourseRow,
  input: LearningAnalyticsBatchControlInput
): CourseWorkflowMode {
  if (input.selection === 'explicit-full') return 'full'
  if (
    !row.areAnalyticsValid ||
    !row.analyticsLastComputedAt ||
    row.hasDirtyLearningAnalyticsChoice
  )
    return 'full'
  const finalizationCutoff = new Date(`${input.batchDate}T00:00:00.000Z`)
  finalizationCutoff.setUTCDate(
    finalizationCutoff.getUTCDate() - FINALIZATION_GRACE_DAYS
  )
  if (
    row.isLearningAnalyticsEnabled &&
    !row.isArchived &&
    row.analyticsFinalizedAt === null &&
    row.endDate.valueOf() <= finalizationCutoff.valueOf()
  ) {
    return 'finalize'
  }
  return 'incremental'
}

function courseRequest(
  row: SelectedCourseRow,
  input: LearningAnalyticsBatchControlInput
): LearningAnalyticsCourseControlInput {
  const mode = courseMode(row, input)
  return {
    contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
    runId: input.runId,
    courseId: row.id,
    mode,
    ...(mode === 'incremental' && row.analyticsLastComputedAt
      ? { windowSince: row.analyticsLastComputedAt.toISOString().slice(0, 10) }
      : {}),
  }
}

function fullCourseRequest(
  request: LearningAnalyticsCourseControlInput
): LearningAnalyticsCourseControlInput {
  return {
    contractVersion: request.contractVersion,
    runId: request.runId,
    courseId: request.courseId,
    mode: 'full',
  }
}

function cleanupPriority(row: SelectedCourseRow): number {
  if (
    !row.isLearningAnalyticsEnabled ||
    row.isArchived ||
    row.hasDirtyLearningAnalyticsChoice
  )
    return 0
  if (!row.areAnalyticsValid) return 1
  return 2
}

export async function selectLearningAnalyticsBatchCourses(
  input: LearningAnalyticsBatchControlInput,
  prisma: Pick<DB.PrismaClient, '$queryRaw'>
): Promise<LearningAnalyticsBatchSelectionOutput> {
  requireValidBatchInput(input)

  const explicitCourseIds = isExplicitCourseSelection(input)
    ? [...new Set(input.explicitCourseIds)].sort()
    : undefined
  const rows: SelectedCourseRow[] = []
  let cursor = FIRST_UUID
  const candidatePredicate = explicitCourseIds
    ? DB.Prisma.sql`c."id" IN (${DB.Prisma.join(
        explicitCourseIds.map((id) => DB.Prisma.sql`CAST(${id} AS uuid)`)
      )})`
    : DB.Prisma.sql`c."isLearningAnalyticsEnabled" IS TRUE
        OR EXISTS (
          SELECT 1
          FROM (
            SELECT pa."participantId"
            FROM "ParticipantAnalytics" AS pa
            WHERE pa."courseId" = c."id"
            UNION ALL
            SELECT pca."participantId"
            FROM "ParticipantCourseAnalytics" AS pca
            WHERE pca."courseId" = c."id"
            UNION ALL
            SELECT pp."participantId"
            FROM "ParticipantPerformance" AS pp
            WHERE pp."courseId" = c."id"
            UNION ALL
            SELECT pap."participantId"
            FROM "ParticipantActivityPerformance" AS pap
            JOIN "PracticeQuiz" AS pq ON pq."id" = pap."practiceQuizId"
            WHERE pq."courseId" = c."id"
            UNION ALL
            SELECT pap."participantId"
            FROM "ParticipantActivityPerformance" AS pap
            JOIN "MicroLearning" AS ml ON ml."id" = pap."microLearningId"
            WHERE ml."courseId" = c."id"
            UNION ALL
            SELECT pchat."participantId"
            FROM "ParticipantChatAnalytics" AS pchat
            JOIN "Chatbot" AS chatbot ON chatbot."id" = pchat."chatbotId"
            WHERE chatbot."courseId" = c."id"
            UNION ALL
            SELECT outcome."participantId"
            FROM "ParticipantChatOutcome" AS outcome
            WHERE outcome."courseId" = c."id"
            UNION ALL
            SELECT plq."participantId"
            FROM "ParticipantLiveQuizAnalytics" AS plq
            JOIN "LiveQuiz" AS quiz ON quiz."id" = plq."liveQuizId"
            WHERE quiz."courseId" = c."id"
          ) AS individual_rows
          JOIN "Participant" AS participant
            ON participant."id" = individual_rows."participantId"
          LEFT JOIN "Participation" AS membership
            ON membership."courseId" = c."id"
            AND membership."participantId" = individual_rows."participantId"
          WHERE
            c."isLearningAnalyticsEnabled" IS NOT TRUE
            OR c."isArchived" IS TRUE
            OR membership."id" IS NULL
            OR participant."learningAnalyticsConsent" IS NOT TRUE
            OR participant."learningAnalyticsChoiceAt" IS NULL
            OR NULLIF(
              btrim(participant."learningAnalyticsDisclosureVersion"),
              ''
            ) IS NULL
            OR c."analyticsLastComputedAt" IS NULL
            OR c."analyticsLastComputedAt"
              <= participant."learningAnalyticsChoiceAt"
        )`

  while (true) {
    const page = await prisma.$queryRaw<SelectedCourseRow[]>(DB.Prisma.sql`
      WITH candidate_courses AS MATERIALIZED (
        SELECT c."id"
        FROM "Course" AS c
        WHERE c."id" > CAST(${cursor} AS uuid)
          AND (
            ${candidatePredicate}
          )
        ORDER BY c."id"
        LIMIT ${SELECTOR_PAGE_SIZE}
      )
      SELECT
        c."id",
        c."isLearningAnalyticsEnabled",
        c."isArchived",
        c."areAnalyticsValid",
        c."analyticsLastComputedAt",
        c."analyticsFinalizedAt",
        c."endDate",
        EXISTS (
          SELECT 1
          FROM "Participation" AS choice_membership
          JOIN "Participant" AS choice_participant
            ON choice_participant."id" = choice_membership."participantId"
          WHERE choice_membership."courseId" = c."id"
            AND choice_participant."learningAnalyticsChoiceAt"
              >= c."analyticsLastComputedAt"
        ) AS "hasDirtyLearningAnalyticsChoice"
      FROM "Course" AS c
      JOIN candidate_courses AS candidates ON candidates."id" = c."id"
      ORDER BY c."id"
    `)
    rows.push(...page)
    if (page.length < SELECTOR_PAGE_SIZE) break
    cursor = page.at(-1)!.id
  }

  if (explicitCourseIds && rows.length !== explicitCourseIds.length) {
    throw new Error('One or more explicitly selected courses do not exist')
  }

  rows.sort(
    (left, right) =>
      cleanupPriority(left) - cleanupPriority(right) ||
      left.id.localeCompare(right.id)
  )
  return { courses: rows.map((row) => courseRequest(row, input)) }
}

export async function canStartLearningAnalyticsCourse(
  { stopSpawningAt }: { stopSpawningAt: string },
  prisma: Pick<DB.PrismaClient, '$queryRaw'>
): Promise<boolean> {
  const deadline = new Date(rfc3339DateTimeSchema.parse(stopSpawningAt))
  const rows = await prisma.$queryRaw<Array<{ canStart: boolean }>>(
    DB.Prisma.sql`
      SELECT clock_timestamp() < ${deadline} AS "canStart"
    `
  )
  if (!rows[0]) throw new Error('PostgreSQL did not return a spawn decision')
  return rows[0].canStart
}

export async function startLearningAnalyticsCourse(
  input: LearningAnalyticsCourseControlInput,
  prisma: DB.PrismaClient
): Promise<LearningAnalyticsCourseStartOutput> {
  const request = courseWorkflowInputSchema.parse(input)
  return prisma.$transaction(async (transaction) => {
    await lockLearningAnalyticsCourseMutation(transaction, request.courseId)
    const fenceRows = await transaction.$queryRaw<Array<{ fenceAt: Date }>>(
      DB.Prisma.sql`
        SELECT clock_timestamp() AS "fenceAt"
      `
    )
    const fenceAt = fenceRows[0]?.fenceAt
    if (!(fenceAt instanceof Date) || Number.isNaN(fenceAt.valueOf())) {
      throw new Error('PostgreSQL did not return an analytics fence')
    }

    const course = await transaction.course.findUnique({
      where: { id: request.courseId },
      select: {
        isLearningAnalyticsEnabled: true,
        isArchived: true,
        areAnalyticsValid: true,
        analyticsLastComputedAt: true,
      },
    })
    if (!course) throw new Error('Learning-analytics course does not exist')

    let effectiveRequest = request
    if (request.mode !== 'full') {
      let requiresFull =
        !course.areAnalyticsValid || course.analyticsLastComputedAt === null
      if (!requiresFull) {
        const revisionRows = await transaction.$queryRaw<
          Array<{ hasRecentChoice: boolean }>
        >(
          DB.Prisma.sql`
            SELECT EXISTS (
              SELECT 1
              FROM "Participation" AS membership
              JOIN "Participant" AS participant
                ON participant."id" = membership."participantId"
              WHERE membership."courseId" = CAST(${request.courseId} AS uuid)
                AND participant."learningAnalyticsChoiceAt"
                  >= ${course.analyticsLastComputedAt}
            ) AS "hasRecentChoice"
          `
        )
        const recentChoice = revisionRows[0]?.hasRecentChoice
        if (typeof recentChoice !== 'boolean') {
          throw new Error(
            'PostgreSQL did not return an analytics revision check'
          )
        }
        requiresFull = recentChoice
      }
      if (requiresFull) effectiveRequest = fullCourseRequest(request)
    }

    const cleanupOnly = !course.isLearningAnalyticsEnabled || course.isArchived
    if (!cleanupOnly) {
      await transaction.course.update({
        where: { id: request.courseId },
        data: { areAnalyticsValid: false, chatAnalyticsValidAt: null },
      })
    }
    return {
      courseId: request.courseId,
      request: effectiveRequest,
      cleanupOnly,
      fenceAt: fenceAt.toISOString(),
    }
  })
}

export async function completeLearningAnalyticsCourse(
  input: LearningAnalyticsCourseCompletionInput,
  prisma: DB.PrismaClient
): Promise<LearningAnalyticsCourseControlOutput> {
  const request = courseWorkflowInputSchema.parse(input.request)
  const completedAtValue = rfc3339DateTimeSchema.parse(input.completedAt)
  const fenceAtValue = rfc3339DateTimeSchema.parse(input.fenceAt)
  const fenceAt = new Date(fenceAtValue)

  const cleanupOnly = await prisma.$transaction(async (transaction) => {
    await lockLearningAnalyticsCourseMutation(transaction, request.courseId)
    const course = await transaction.course.findUnique({
      where: { id: request.courseId },
      select: {
        isLearningAnalyticsEnabled: true,
        isArchived: true,
        analyticsLastComputedAt: true,
      },
    })
    if (!course) throw new Error('Learning-analytics course does not exist')

    const isCleanupOnly =
      input.cleanupOnly ||
      !course.isLearningAnalyticsEnabled ||
      course.isArchived
    if (
      isCleanupOnly ||
      (course.analyticsLastComputedAt &&
        course.analyticsLastComputedAt > fenceAt)
    ) {
      return isCleanupOnly
    }

    const revisionRows = await transaction.$queryRaw<
      Array<{ hasRecentChoice: boolean }>
    >(
      DB.Prisma.sql`
        SELECT EXISTS (
          SELECT 1
          FROM "Participation" AS membership
          JOIN "Participant" AS participant
            ON participant."id" = membership."participantId"
          WHERE membership."courseId" = CAST(${request.courseId} AS uuid)
            AND participant."learningAnalyticsChoiceAt" >= ${fenceAt}
        ) AS "hasRecentChoice"
      `
    )
    const hasRecentChoice = revisionRows[0]?.hasRecentChoice
    if (typeof hasRecentChoice !== 'boolean') {
      throw new Error('PostgreSQL did not return an analytics revision check')
    }
    if (hasRecentChoice) return isCleanupOnly

    const publicationRows = await transaction.$queryRaw<
      Array<{ publicationAt: Date }>
    >(
      DB.Prisma.sql`
        SELECT clock_timestamp() AS "publicationAt"
      `
    )
    const publicationAt = publicationRows[0]?.publicationAt
    if (
      !(publicationAt instanceof Date) ||
      Number.isNaN(publicationAt.valueOf())
    ) {
      throw new Error('PostgreSQL did not return an analytics publication time')
    }

    await transaction.course.update({
      where: { id: request.courseId },
      data: {
        areAnalyticsValid: true,
        analyticsLastComputedAt: publicationAt,
        chatAnalyticsValidAt: publicationAt,
        ...(request.mode === 'finalize'
          ? { analyticsFinalizedAt: publicationAt }
          : {}),
      },
    })
    return false
  })

  return {
    courseId: request.courseId,
    completedAt: completedAtValue,
    cleanupOnly,
  }
}

export async function dispatchCourseLearningAnalytics(
  {
    courseId,
    mode,
  }: { courseId: string; mode: LearningAnalyticsCourseControlInput['mode'] },
  ctx: ContextWithUser
): Promise<boolean> {
  if (!isLearningAnalyticsCoordinatorEnabled()) {
    throw coordinatorDisabledError()
  }
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId },
    select: { analyticsLastComputedAt: true },
  })
  if (!course) return false

  const runId = randomUUID()
  const input = courseWorkflowInputSchema.parse({
    contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
    runId,
    courseId,
    mode,
    ...(mode === 'incremental' && course.analyticsLastComputedAt
      ? {
          windowSince: course.analyticsLastComputedAt
            .toISOString()
            .slice(0, 10),
        }
      : {}),
  })
  await ctx.tasks.learningAnalyticsCourseCoordinator.runNoWait(input, {
    additionalMetadata: {
      component: 'public-learning-analytics-coordinator',
      contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
      runId,
      courseId,
      mode,
    },
  })
  return true
}

export async function dispatchFullLearningAnalyticsBatch(
  { courseIds }: { courseIds: string[] },
  ctx: ContextWithUser
): Promise<boolean> {
  if (!isLearningAnalyticsCoordinatorEnabled()) {
    throw coordinatorDisabledError()
  }
  const explicitCourseIds = [...new Set(courseIds)].sort()
  if (explicitCourseIds.length === 0) return false
  if (!explicitCourseIds.every((id) => uuidValidate(id))) {
    throw new Error('Full analytics batches require valid course IDs')
  }
  const clock = await readBatchClock(ctx.prisma, 'manual')
  const input = buildBatchInput({
    clock,
    selection: 'explicit-full',
    explicitCourseIds,
  })
  requireValidBatchInput(input)
  await ctx.tasks.learningAnalyticsBatchCoordinator.runNoWait(input, {
    additionalMetadata: {
      component: 'public-learning-analytics-coordinator',
      contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
      runId: input.runId,
    },
  })
  return true
}

export const handlePrepareScheduledLearningAnalyticsBatch: HatchetHandlers['handlePrepareScheduledLearningAnalyticsBatch'] =
  async (_args, globalCtx) =>
    prepareScheduledLearningAnalyticsBatch(globalCtx.prisma)

export const handleSelectLearningAnalyticsBatchCourses: HatchetHandlers['handleSelectLearningAnalyticsBatchCourses'] =
  async (args, globalCtx) =>
    selectLearningAnalyticsBatchCourses(args, globalCtx.prisma)

export const handleGetLearningAnalyticsBatchDeadline: HatchetHandlers['handleGetLearningAnalyticsBatchDeadline'] =
  async (args, globalCtx) =>
    getLearningAnalyticsBatchDeadline(args, globalCtx.prisma)

export const handleCanStartLearningAnalyticsCourse: HatchetHandlers['handleCanStartLearningAnalyticsCourse'] =
  async (args, globalCtx) =>
    canStartLearningAnalyticsCourse(args, globalCtx.prisma)

export const handleStartLearningAnalyticsCourse: HatchetHandlers['handleStartLearningAnalyticsCourse'] =
  async (args, globalCtx) =>
    startLearningAnalyticsCourse(args, globalCtx.prisma)

export const handleCompleteLearningAnalyticsCourse: HatchetHandlers['handleCompleteLearningAnalyticsCourse'] =
  async (args, globalCtx) =>
    completeLearningAnalyticsCourse(args, globalCtx.prisma)
