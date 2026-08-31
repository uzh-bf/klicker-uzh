import { randomUUID } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import type { HatchetHandlers } from '@klicker-uzh/types'
import {
  getLiveQuizCourseDeletedKey,
  trySetLiveQuizCourseDeletedFence,
} from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import type { Redis } from 'ioredis'
import type { ContextWithUser } from '../lib/context.js'
import {
  acquireCourseDeletionLock,
  getCourseDeletionCourseLockKey,
  getCourseDeletionStatusKey,
  isTerminalCourseDeletionStatus,
} from './courseDeletionGuard.js'
import {
  type CourseDeletionDraftActivityIds,
  clearCourseDeletionPending,
  markCourseDeletionPending,
} from './courseDeletionState.js'
import { deleteCourse } from './courses.js'

const COURSE_DELETION_STATUS_TTL_SECONDS = 24 * 60 * 60
const COURSE_DELETION_STALE_AFTER_MS = 75 * 60 * 1000
const COURSE_DELETION_REPUBLISH_AFTER_MS = 5 * 60 * 1000
const COURSE_DELETION_PROCESS_LOCK_TTL_SECONDS = 60
const COURSE_DELETION_PROCESS_LOCK_RENEWAL_MS = 15 * 1000
const COURSE_DELETION_HEARTBEAT_TTL_SECONDS = 120
const COURSE_DELETION_RESPONSE_FENCE_WAIT_MS = 5 * 60 * 1000
const COURSE_DELETION_RESPONSE_FENCE_POLL_MS = 250
const COURSE_DELETION_UNPUBLISHED_ADMISSION_STALE_MS = 15 * 60 * 1000
const COURSE_DELETION_PUBLISHED_ADMISSION_RECONCILE_MS = 15 * 60 * 1000
const COURSE_DELETION_ADMISSION_RECONCILE_COOLDOWN_MS = 30 * 60 * 1000
const COURSE_DELETION_ADMISSION_RECONCILE_BATCH_SIZE = 20
const COURSE_DELETION_RETRY_PROTECTION_MS = 60 * 60 * 1000

export const COURSE_DELETION_JOB_STATUS_VALUES = [
  'COMPLETED',
  'FAILED',
  'PENDING',
  'RUNNING',
] as const

export type CourseDeletionJobStatus =
  (typeof COURSE_DELETION_JOB_STATUS_VALUES)[number]
export type CourseDeletionErrorType = 'access' | 'generic' | 'notAllowed'

export interface CourseDeletionStatus {
  id: string
  status: CourseDeletionJobStatus
  isQueued: boolean
  courseId: string
  courseName: string
  errorType?: CourseDeletionErrorType | null
  errorMessage?: string | null
  createdAt: Date
  updatedAt: Date
}

interface CourseDeletionJob extends Omit<CourseDeletionStatus, 'isQueued'> {
  userId: string
  userRole: DB.UserRole
  userScope: DB.UserLoginScope
  catalystInstitutional: boolean
  catalystIndividual: boolean
  deleteDraftActivities?: boolean
  draftActivityIds?: CourseDeletionDraftActivityIds
  liveQuizIds?: string[]
  lastPublicationAttemptAt?: number
  publicationRecoveryAttempts?: number
  publicationRecoveryNeeded?: boolean
  scheduledTaskIds?: string[]
  retryProtectedUntil?: number
}

async function persistCourseDeletionResponseFences(
  redis: Redis,
  liveQuizIds: string[],
  value: string,
  ttlSeconds?: number
) {
  if (liveQuizIds.length === 0) return

  const pipeline = redis.pipeline()
  for (const liveQuizId of liveQuizIds) {
    if (ttlSeconds) {
      pipeline.set(
        getLiveQuizCourseDeletedKey(liveQuizId),
        value,
        'EX',
        ttlSeconds
      )
    } else {
      pipeline.set(getLiveQuizCourseDeletedKey(liveQuizId), value)
    }
  }

  const results = await pipeline.exec()
  for (const [error] of results ?? []) {
    if (error) throw error
  }
}

async function waitForCourseDeletionResponseFences(
  redis: Redis,
  liveQuizIds: string[],
  value: string,
  ttlSeconds: number
) {
  const pendingIds = new Set(liveQuizIds)
  const deadline = Date.now() + COURSE_DELETION_RESPONSE_FENCE_WAIT_MS

  while (pendingIds.size > 0) {
    for (const liveQuizId of pendingIds) {
      if (
        await trySetLiveQuizCourseDeletedFence(
          redis,
          liveQuizId,
          value,
          ttlSeconds
        )
      ) {
        pendingIds.delete(liveQuizId)
      }
    }

    if (pendingIds.size === 0) return
    if (Date.now() >= deadline) {
      throw new GraphQLError(
        'Timed out waiting for active response processing to finish',
        { extensions: { code: 'COURSE_DELETION_RESPONSE_FENCE_TIMEOUT' } }
      )
    }
    await new Promise((resolve) =>
      setTimeout(resolve, COURSE_DELETION_RESPONSE_FENCE_POLL_MS)
    )
  }
}

async function waitForCourseDeletionResponseAdmissions(
  prisma: ContextWithUser['prisma'],
  courseId: string
) {
  const deadline = Date.now() + COURSE_DELETION_RESPONSE_FENCE_WAIT_MS

  while (true) {
    await prisma.liveQuizResponseAdmission.deleteMany({
      where: {
        courseId,
        OR: [
          { failedAt: { not: null } },
          {
            publishedAt: null,
            createdAt: {
              lte: new Date(
                Date.now() - COURSE_DELETION_UNPUBLISHED_ADMISSION_STALE_MS
              ),
            },
          },
        ],
      },
    })
    const pendingAdmission = await prisma.liveQuizResponseAdmission.findFirst({
      where: { courseId, failedAt: null },
      select: { token: true },
    })
    if (!pendingAdmission) return
    if (Date.now() >= deadline) {
      throw new GraphQLError(
        'Timed out waiting for accepted responses to finish',
        {
          extensions: {
            code: 'COURSE_DELETION_RESPONSE_ADMISSION_TIMEOUT',
          },
        }
      )
    }
    await new Promise((resolve) =>
      setTimeout(resolve, COURSE_DELETION_RESPONSE_FENCE_POLL_MS)
    )
  }
}

async function releaseCourseDeletionResponseFences(
  redis: Redis,
  liveQuizIds: string[],
  expectedValue: string
) {
  await Promise.all(
    liveQuizIds.map((liveQuizId) =>
      releaseCourseDeletionLockValue(
        redis,
        getLiveQuizCourseDeletedKey(liveQuizId),
        expectedValue
      )
    )
  )
}

function getCourseDeletionProcessLockKey(jobId: string) {
  return `${getCourseDeletionStatusKey(jobId)}:processing`
}

function getCourseDeletionHeartbeatKey(jobId: string) {
  return `${getCourseDeletionStatusKey(jobId)}:heartbeat`
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error

  if (error && typeof error === 'object') {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }

  return String(error)
}

function isTerminalHatchetEventSummary(summary: {
  cancelled?: number
  failed?: number
  pending?: number
  queued?: number
  running?: number
  succeeded?: number
}) {
  const active =
    (summary.pending ?? 0) + (summary.queued ?? 0) + (summary.running ?? 0)
  const terminal =
    (summary.cancelled ?? 0) + (summary.failed ?? 0) + (summary.succeeded ?? 0)

  return active === 0 && terminal > 0
}

async function reconcileTerminalLiveQuizResponseAdmissions(
  globalCtx: Parameters<HatchetHandlers['handleSweepStaleCourseDeletions']>[1],
  warn: (message: string) => void
) {
  const reconciliationStartedAt = new Date()
  const reconciliationRetryBefore = new Date(
    reconciliationStartedAt.getTime() -
      COURSE_DELETION_ADMISSION_RECONCILE_COOLDOWN_MS
  )
  const admissions = await globalCtx.prisma.liveQuizResponseAdmission.findMany({
    where: {
      eventId: { not: null },
      failedAt: null,
      OR: [
        { lastReconciliationAttemptAt: null },
        {
          lastReconciliationAttemptAt: {
            lte: reconciliationRetryBefore,
          },
        },
      ],
      publishedAt: {
        lte: new Date(
          Date.now() - COURSE_DELETION_PUBLISHED_ADMISSION_RECONCILE_MS
        ),
      },
    },
    orderBy: [
      {
        lastReconciliationAttemptAt: { nulls: 'first', sort: 'asc' },
      },
      { publishedAt: 'asc' },
    ],
    select: { eventId: true, token: true },
    take: COURSE_DELETION_ADMISSION_RECONCILE_BATCH_SIZE,
  })

  let terminalizedAdmissions = 0
  for (const admission of admissions) {
    if (!admission.eventId) continue

    const claimed = await globalCtx.prisma.liveQuizResponseAdmission.updateMany(
      {
        where: {
          eventId: admission.eventId,
          failedAt: null,
          token: admission.token,
          OR: [
            { lastReconciliationAttemptAt: null },
            {
              lastReconciliationAttemptAt: {
                lte: reconciliationRetryBefore,
              },
            },
          ],
        },
        data: { lastReconciliationAttemptAt: reconciliationStartedAt },
      }
    )
    if (claimed.count === 0) continue

    try {
      const event = await globalCtx.hatchet.api.eventGet(admission.eventId)
      const summary = event.data.workflowRunSummary
      if (!summary || !isTerminalHatchetEventSummary(summary)) continue

      const terminalized =
        await globalCtx.prisma.liveQuizResponseAdmission.updateMany({
          where: {
            eventId: admission.eventId,
            failedAt: null,
            token: admission.token,
          },
          data: { failedAt: new Date() },
        })
      terminalizedAdmissions += terminalized.count
    } catch (error) {
      warn(
        `Could not reconcile live quiz response admission ${admission.token} from Hatchet event ${admission.eventId}: ${getErrorMessage(error)}`
      )
    }
  }

  return { inspectedAdmissions: admissions.length, terminalizedAdmissions }
}

function hasCourseDeletionLoginScope(scope: DB.UserLoginScope) {
  return (
    scope === DB.UserLoginScope.ACCOUNT_OWNER ||
    scope === DB.UserLoginScope.FULL_ACCESS
  )
}

function getGraphQLErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined

  const extensions = (error as { extensions?: { code?: unknown } }).extensions
  if (typeof extensions?.code === 'string') return extensions.code

  const graphQLErrors = (error as { graphQLErrors?: unknown[] }).graphQLErrors
  for (const graphQLError of graphQLErrors ?? []) {
    const code = getGraphQLErrorCode(graphQLError)
    if (code) return code
  }

  const errors = (error as { errors?: unknown[] }).errors
  for (const nestedError of errors ?? []) {
    const code = getGraphQLErrorCode(nestedError)
    if (code) return code
  }

  return undefined
}

function getCourseDeletionErrorType(error: unknown): CourseDeletionErrorType {
  const code = getGraphQLErrorCode(error)
  if (code === 'FORBIDDEN') return 'access'
  if (code === 'COURSE_DELETION_NOT_ALLOWED') return 'notAllowed'
  return 'generic'
}

function parseCourseDeletionDate(value: unknown) {
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function parseCourseDeletionJob(rawJob: string | null) {
  if (!rawJob) return null

  try {
    const job = JSON.parse(rawJob) as CourseDeletionJob
    return {
      ...job,
      createdAt: parseCourseDeletionDate(job.createdAt),
      updatedAt: parseCourseDeletionDate(job.updatedAt),
    } satisfies CourseDeletionJob
  } catch (error) {
    console.error('Failed to parse course deletion job status:', error)
    return null
  }
}

async function getCourseDeletionJob(redis: Redis, jobId: string) {
  return parseCourseDeletionJob(
    await redis.get(getCourseDeletionStatusKey(jobId))
  )
}

function serializeCourseDeletionJob(job: CourseDeletionJob) {
  if (!isTerminalCourseDeletionStatus(job.status)) {
    return JSON.stringify(job)
  }

  return JSON.stringify({
    id: job.id,
    status: job.status,
    isQueued: true,
    courseId: job.courseId,
    courseName: job.courseName,
    errorType: job.errorType,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    userId: job.userId,
  } satisfies CourseDeletionStatus & Pick<CourseDeletionJob, 'userId'>)
}

async function persistCourseDeletionJob(redis: Redis, job: CourseDeletionJob) {
  await redis.set(
    getCourseDeletionStatusKey(job.id),
    serializeCourseDeletionJob(job),
    'EX',
    COURSE_DELETION_STATUS_TTL_SECONDS
  )
}

async function deleteCourseDeletionJob(redis: Redis, jobId: string) {
  await redis.del(getCourseDeletionStatusKey(jobId))
}

async function releaseCourseDeletionLockValue(
  redis: Redis,
  lockKey: string,
  value: string
) {
  await redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    end
    return 0`,
    1,
    lockKey,
    value
  )
}

async function releaseCourseDeletionCourseLock(
  redis: Redis,
  job: CourseDeletionJob
) {
  await releaseCourseDeletionLockValue(
    redis,
    getCourseDeletionCourseLockKey(job.courseId),
    job.id
  )
}

async function renewCourseDeletionProcessLock(
  redis: Redis,
  lockKey: string,
  value: string
) {
  const renewed = await redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("expire", KEYS[1], ARGV[2])
    end
    return 0`,
    1,
    lockKey,
    value,
    COURSE_DELETION_PROCESS_LOCK_TTL_SECONDS
  )
  return Number(renewed) === 1
}

async function renewCourseDeletionHeartbeat(redis: Redis, jobId: string) {
  const set = await redis.set(
    getCourseDeletionHeartbeatKey(jobId),
    '1',
    'EX',
    COURSE_DELETION_HEARTBEAT_TTL_SECONDS
  )
  return set === 'OK'
}

async function hasFreshCourseDeletionHeartbeat(redis: Redis, jobId: string) {
  return (await redis.get(getCourseDeletionHeartbeatKey(jobId))) === '1'
}

async function updateCourseDeletionJob(
  redis: Redis,
  job: CourseDeletionJob,
  patch: Partial<
    Pick<
      CourseDeletionJob,
      | 'draftActivityIds'
      | 'errorMessage'
      | 'errorType'
      | 'lastPublicationAttemptAt'
      | 'publicationRecoveryAttempts'
      | 'publicationRecoveryNeeded'
      | 'retryProtectedUntil'
      | 'liveQuizIds'
      | 'scheduledTaskIds'
      | 'status'
    >
  >
) {
  const updatedJob = {
    ...job,
    ...patch,
    updatedAt: new Date(),
  } satisfies CourseDeletionJob

  await persistCourseDeletionJob(redis, updatedJob)

  if (isTerminalCourseDeletionStatus(updatedJob.status)) {
    await releaseCourseDeletionCourseLock(redis, updatedJob)
  }

  return updatedJob
}

async function transitionPendingCourseDeletionPublicationRecovery(
  redis: Redis,
  job: CourseDeletionJob,
  patch: Pick<
    CourseDeletionJob,
    | 'lastPublicationAttemptAt'
    | 'publicationRecoveryAttempts'
    | 'publicationRecoveryNeeded'
  >
) {
  if (job.status !== 'PENDING') return null

  const updatedJob = {
    ...job,
    ...patch,
    updatedAt: new Date(),
  } satisfies CourseDeletionJob

  const transitioned = await redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1]
      and redis.call("exists", KEYS[2]) == 0
      and redis.call("exists", KEYS[3]) == 0 then
      redis.call("set", KEYS[1], ARGV[2], "EX", ARGV[3])
      return 1
    end
    return 0`,
    3,
    getCourseDeletionStatusKey(job.id),
    getCourseDeletionProcessLockKey(job.id),
    getCourseDeletionHeartbeatKey(job.id),
    serializeCourseDeletionJob(job),
    serializeCourseDeletionJob(updatedJob),
    COURSE_DELETION_STATUS_TTL_SECONDS
  )

  return Number(transitioned) === 1 ? updatedJob : null
}

async function transitionStaleCourseDeletionJob(
  redis: Redis,
  job: CourseDeletionJob,
  patch: Partial<
    Pick<CourseDeletionJob, 'errorMessage' | 'errorType' | 'status'>
  >
) {
  const updatedJob = {
    ...job,
    ...patch,
    updatedAt: new Date(),
  } satisfies CourseDeletionJob

  const transitioned = await redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1]
      and redis.call("exists", KEYS[2]) == 0
      and redis.call("exists", KEYS[3]) == 0 then
      redis.call("set", KEYS[1], ARGV[2], "EX", ARGV[3])
      return 1
    end
    return 0`,
    3,
    getCourseDeletionStatusKey(job.id),
    getCourseDeletionProcessLockKey(job.id),
    getCourseDeletionHeartbeatKey(job.id),
    serializeCourseDeletionJob(job),
    serializeCourseDeletionJob(updatedJob),
    COURSE_DELETION_STATUS_TTL_SECONDS
  )

  if (Number(transitioned) !== 1) return null

  await releaseCourseDeletionCourseLock(redis, updatedJob)
  return updatedJob
}

async function updateCourseDeletionJobForProcess(
  redis: Redis,
  job: CourseDeletionJob,
  patch: Parameters<typeof updateCourseDeletionJob>[2],
  processLockKey: string,
  processLockValue: string
) {
  const updatedJob = {
    ...job,
    ...patch,
    updatedAt: new Date(),
  } satisfies CourseDeletionJob

  const persisted = await redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then
      redis.call("set", KEYS[2], ARGV[2], "EX", ARGV[3])
      return 1
    end
    return 0`,
    2,
    processLockKey,
    getCourseDeletionStatusKey(job.id),
    processLockValue,
    serializeCourseDeletionJob(updatedJob),
    COURSE_DELETION_STATUS_TTL_SECONDS
  )

  if (Number(persisted) !== 1) {
    throw new GraphQLError('Course deletion process lease was lost', {
      extensions: { code: 'COURSE_DELETION_PROCESS_LEASE_LOST' },
    })
  }

  if (isTerminalCourseDeletionStatus(updatedJob.status)) {
    await releaseCourseDeletionCourseLock(redis, updatedJob)
  }

  return updatedJob
}

async function protectCourseDeletionRetry(
  redis: Redis,
  job: CourseDeletionJob
) {
  const protectedJob = {
    ...job,
    retryProtectedUntil: Date.now() + COURSE_DELETION_RETRY_PROTECTION_MS,
    updatedAt: new Date(),
  } satisfies CourseDeletionJob

  const persisted = await redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then
      redis.call("set", KEYS[1], ARGV[2], "EX", ARGV[3])
      return 1
    end
    return 0`,
    1,
    getCourseDeletionStatusKey(job.id),
    serializeCourseDeletionJob(job),
    serializeCourseDeletionJob(protectedJob),
    COURSE_DELETION_STATUS_TTL_SECONDS
  )

  return Number(persisted) === 1 ? protectedJob : null
}

async function recoverCourseDeletionPostCommit(
  job: CourseDeletionJob,
  ctx: Pick<ContextWithUser, 'emitter' | 'hatchet' | 'redisExec'>,
  warn: (message: string) => void
) {
  if (job.liveQuizIds?.length) {
    try {
      await persistCourseDeletionResponseFences(
        ctx.redisExec,
        job.liveQuizIds,
        '1'
      )
    } catch (error) {
      warn(
        `Failed to recover the response fence for course deletion job ${job.id}: ${getErrorMessage(error)}`
      )
    }
  }

  for (const taskId of job.scheduledTaskIds ?? []) {
    try {
      await ctx.hatchet.scheduled.delete(taskId)
    } catch (error) {
      warn(
        `Failed to recover scheduled task cleanup ${taskId} for course deletion job ${job.id}: ${getErrorMessage(error)}`
      )
    }
  }

  const draftActivityIds = job.draftActivityIds
  if (draftActivityIds) {
    for (const id of draftActivityIds.liveQuizIds) {
      ctx.emitter.emit('invalidate', { typename: 'LiveQuiz', id })
    }
    for (const id of draftActivityIds.practiceQuizIds) {
      ctx.emitter.emit('invalidate', { typename: 'PracticeQuiz', id })
    }
    for (const id of draftActivityIds.microLearningIds) {
      ctx.emitter.emit('invalidate', { typename: 'MicroLearning', id })
    }
    for (const id of draftActivityIds.groupActivityIds) {
      ctx.emitter.emit('invalidate', { typename: 'GroupActivity', id })
    }
  }
  ctx.emitter.emit('invalidate', {
    typename: 'Course',
    id: job.courseId,
  })
}

function getPublicCourseDeletionStatus(
  job: CourseDeletionJob
): CourseDeletionStatus {
  return {
    id: job.id,
    status: job.status,
    isQueued:
      job.status !== 'PENDING' || job.publicationRecoveryNeeded !== true,
    courseId: job.courseId,
    courseName: job.courseName,
    errorType: job.errorType,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

async function ensureCourseDeletionPending(
  prisma: ContextWithUser['prisma'],
  job: CourseDeletionJob
) {
  const marked = await markCourseDeletionPending(prisma, {
    courseId: job.courseId,
    deleteDraftActivities: job.deleteDraftActivities ?? false,
    jobId: job.id,
    requestedById: job.userId,
  })
  if (marked) return

  // Hatchet can process a small course between event acknowledgement and this
  // write. In that case the same job has already reached its durable success
  // state, so the initiating request should still report an accepted job.
  const course = await prisma.course.findUnique({
    where: { id: job.courseId },
    select: { deletionJobId: true, isDeleted: true, isDeletionPending: true },
  })
  if (course?.isDeleted) return
  if (course?.isDeletionPending && course.deletionJobId === job.id) return

  throw new GraphQLError('Course deletion target is no longer available', {
    extensions: { code: 'COURSE_DELETION_TARGET_UNAVAILABLE' },
  })
}

async function publishCourseDeletionEvent(
  hatchet: ContextWithUser['hatchet'],
  jobId: string
) {
  try {
    await hatchet.events.push('process-course-deletion', { jobId })
  } catch (error) {
    try {
      await hatchet.events.push('process-course-deletion', { jobId })
    } catch (retryError) {
      const publishError = new Error(
        `Initial publish failed: ${getErrorMessage(error)}; retry failed: ${getErrorMessage(retryError)}`,
        { cause: error instanceof Error ? error : undefined }
      )
      throw new GraphQLError('Course deletion could not be started', {
        extensions: { code: 'COURSE_DELETION_START_FAILED' },
        originalError: publishError,
      })
    }
  }
}

async function publishCourseDeletionEventKeepingPending(
  ctx: Pick<ContextWithUser, 'hatchet' | 'prisma' | 'redisExec'>,
  job: CourseDeletionJob
) {
  try {
    await publishCourseDeletionEvent(ctx.hatchet, job.id)
  } catch (error) {
    // Both pushes can have reached Hatchet even when their acknowledgements
    // were lost. Keep the job and lock active so an accepted event cannot
    // resurrect a FAILED job or race a second start. The stale sweep performs
    // one delayed recovery publication when neither event was accepted.
    console.error(
      `Course deletion job ${job.id} publication acknowledgement failed; keeping the job pending for recovery: ${getErrorMessage(error)}`
    )
    return (
      (await transitionPendingCourseDeletionPublicationRecovery(
        ctx.redisExec,
        job,
        {
          publicationRecoveryNeeded: true,
          publicationRecoveryAttempts: job.publicationRecoveryAttempts ?? 0,
          lastPublicationAttemptAt: Date.now(),
        }
      )) ?? job
    )
  }

  await ensureCourseDeletionPending(ctx.prisma, job)

  if (job.publicationRecoveryNeeded) {
    return (
      (await transitionPendingCourseDeletionPublicationRecovery(
        ctx.redisExec,
        job,
        {
          publicationRecoveryNeeded: false,
          publicationRecoveryAttempts: job.publicationRecoveryAttempts ?? 0,
          lastPublicationAttemptAt: job.lastPublicationAttemptAt,
        }
      )) ?? { ...job, publicationRecoveryNeeded: false }
    )
  }

  return job
}

async function normalizeStaleCourseDeletionJob(
  redis: Redis,
  ctx: Pick<ContextWithUser, 'emitter' | 'hatchet' | 'prisma' | 'redisExec'>,
  job: CourseDeletionJob,
  warn: (message: string) => void = console.warn
) {
  if (
    isTerminalCourseDeletionStatus(job.status) ||
    Date.now() - job.createdAt.getTime() < COURSE_DELETION_STALE_AFTER_MS ||
    (typeof job.retryProtectedUntil === 'number' &&
      Date.now() < job.retryProtectedUntil) ||
    (await hasFreshCourseDeletionHeartbeat(redis, job.id))
  ) {
    return job
  }

  const course = await ctx.prisma.course.findUnique({
    where: { id: job.courseId },
    select: { id: true, isDeleted: true },
  })

  if (!course || course.isDeleted) {
    const completedJob = await transitionStaleCourseDeletionJob(redis, job, {
      status: 'COMPLETED',
    })
    if (completedJob) {
      await recoverCourseDeletionPostCommit(job, ctx, warn)
      console.warn(
        `Course deletion job ${job.id} went stale after its course was soft-deleted; marked COMPLETED.`
      )
      return completedJob
    }

    return (await getCourseDeletionJob(redis, job.id)) ?? job
  }

  const failedJob = await transitionStaleCourseDeletionJob(redis, job, {
    status: 'FAILED',
    errorType: 'generic',
    errorMessage: 'Course deletion did not finish in time.',
  })
  if (failedJob) {
    await releaseCourseDeletionResponseFences(
      redis,
      job.liveQuizIds ?? [],
      job.id
    )
    await clearCourseDeletionPending(ctx.prisma, {
      courseId: job.courseId,
      jobId: job.id,
    })
    console.warn(
      `Course deletion job ${job.id} went stale without a heartbeat; marked FAILED.`
    )
    return failedJob
  }

  return (await getCourseDeletionJob(redis, job.id)) ?? job
}

async function hasCourseDeletionAdminAccess(
  prisma: ContextWithUser['prisma'],
  {
    courseId,
    deletionJobId,
    userId,
  }: { courseId: string; deletionJobId?: string; userId: string }
) {
  const permission = await prisma.derivedPermission.findUnique({
    where: {
      courseId_userId: { courseId, userId },
      permissionLevel: {
        in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
      },
      course: {
        isDeleted: false,
        ...(deletionJobId ? { deletionJobId, isDeletionPending: true } : {}),
      },
    },
    select: { id: true },
  })
  return Boolean(permission)
}

async function snapshotCourseDeletionScope(
  ctx: Pick<ContextWithUser, 'prisma' | 'redisExec'>,
  job: CourseDeletionJob
) {
  const course = await ctx.prisma.course.findUnique({
    where: {
      id: job.courseId,
      isAssessmentEnabled: false,
      isDeleted: false,
    },
    select: {
      name: true,
      liveQuizzes: {
        select: { id: true, isDeleted: true, status: true },
      },
      practiceQuizzes: {
        select: { id: true, isDeleted: true, status: true },
      },
      microLearnings: {
        select: { id: true, isDeleted: true, status: true },
      },
      groupActivities: {
        select: { id: true, isDeleted: true, status: true },
      },
    },
  })
  if (!course) return null

  const getDraftIds = (
    activities: Array<{
      id: string
      isDeleted: boolean
      status: DB.PublicationStatus
    }>
  ) =>
    activities
      .filter(
        (activity) =>
          !activity.isDeleted && activity.status === DB.PublicationStatus.DRAFT
      )
      .map((activity) => activity.id)
  const updatedJob: CourseDeletionJob = {
    ...job,
    courseName: course.name,
    draftActivityIds: {
      liveQuizIds: getDraftIds(course.liveQuizzes),
      practiceQuizIds: getDraftIds(course.practiceQuizzes),
      microLearningIds: getDraftIds(course.microLearnings),
      groupActivityIds: getDraftIds(course.groupActivities),
    },
    liveQuizIds: course.liveQuizzes.map((liveQuiz) => liveQuiz.id),
  }
  await persistCourseDeletionJob(ctx.redisExec, updatedJob)
  return updatedJob
}

export async function startCourseDeletion(
  {
    id,
    deleteDraftActivities,
  }: { id: string; deleteDraftActivities?: boolean | null },
  ctx: ContextWithUser
) {
  if (process.env.COURSE_DELETION_ENABLED === 'false') {
    throw new GraphQLError(
      'Course deletion is temporarily unavailable during rollout',
      { extensions: { code: 'COURSE_DELETION_NOT_ENABLED' } }
    )
  }
  if (!hasCourseDeletionLoginScope(ctx.user.scope)) {
    throw new GraphQLError('Course deletion requires full account access', {
      extensions: { code: 'FORBIDDEN' },
    })
  }
  const hasDeletionAccess = await hasCourseDeletionAdminAccess(ctx.prisma, {
    courseId: id,
    userId: ctx.user.sub,
  })
  if (!hasDeletionAccess) return null

  const course = await ctx.prisma.course.findUnique({
    where: { id, isAssessmentEnabled: false, isDeleted: false },
    select: {
      deletionJobId: true,
      isDeletionPending: true,
      name: true,
    },
  })
  if (!course) return null

  const lockKey = getCourseDeletionCourseLockKey(id)
  const existingJobId = await ctx.redisExec.get(lockKey)
  const existingJob = existingJobId
    ? await getCourseDeletionJob(ctx.redisExec, existingJobId)
    : null

  if (existingJob && !isTerminalCourseDeletionStatus(existingJob.status)) {
    const normalizedJob = await normalizeStaleCourseDeletionJob(
      ctx.redisExec,
      ctx,
      existingJob,
      console.warn
    )

    if (!isTerminalCourseDeletionStatus(normalizedJob.status)) {
      if (normalizedJob.userId !== ctx.user.sub) {
        throw new GraphQLError('Course deletion is already in progress', {
          extensions: { code: 'COURSE_DELETION_IN_PROGRESS' },
        })
      }

      if (normalizedJob.status === 'PENDING') {
        const preparedJob =
          (await snapshotCourseDeletionScope(ctx, normalizedJob)) ??
          normalizedJob
        const publishedJob = await publishCourseDeletionEventKeepingPending(
          ctx,
          preparedJob
        )
        return getPublicCourseDeletionStatus(publishedJob)
      }

      return getPublicCourseDeletionStatus(normalizedJob)
    }
  }

  if (course.isDeletionPending && course.deletionJobId) {
    await clearCourseDeletionPending(ctx.prisma, {
      courseId: id,
      jobId: course.deletionJobId,
    })
  }

  const now = new Date()
  let job: CourseDeletionJob = {
    id: randomUUID(),
    status: 'PENDING',
    courseId: id,
    courseName: course.name,
    errorType: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    userId: ctx.user.sub,
    userRole: ctx.user.role,
    userScope: ctx.user.scope,
    catalystInstitutional: ctx.user.catalystInstitutional,
    catalystIndividual: ctx.user.catalystIndividual,
    deleteDraftActivities: deleteDraftActivities ?? false,
    draftActivityIds: {
      liveQuizIds: [],
      practiceQuizIds: [],
      microLearningIds: [],
      groupActivityIds: [],
    },
    liveQuizIds: [],
  }

  await persistCourseDeletionJob(ctx.redisExec, job)

  const lockAcquired = await acquireCourseDeletionLock(
    ctx.redisExec,
    id,
    job.id,
    COURSE_DELETION_STATUS_TTL_SECONDS
  )

  if (!lockAcquired) {
    const lockedJobId = await ctx.redisExec.get(lockKey)
    const lockedJob = lockedJobId
      ? await getCourseDeletionJob(ctx.redisExec, lockedJobId)
      : null

    if (lockedJob && !isTerminalCourseDeletionStatus(lockedJob.status)) {
      await deleteCourseDeletionJob(ctx.redisExec, job.id)

      if (lockedJob.userId !== ctx.user.sub) {
        throw new GraphQLError('Course deletion is already in progress', {
          extensions: { code: 'COURSE_DELETION_IN_PROGRESS' },
        })
      }

      if (lockedJob.status === 'PENDING') {
        const preparedJob =
          (await snapshotCourseDeletionScope(ctx, lockedJob)) ?? lockedJob
        const publishedJob = await publishCourseDeletionEventKeepingPending(
          ctx,
          preparedJob
        )
        return getPublicCourseDeletionStatus(publishedJob)
      }

      return getPublicCourseDeletionStatus(lockedJob)
    }

    if (lockedJobId) {
      await releaseCourseDeletionLockValue(ctx.redisExec, lockKey, lockedJobId)
    }

    const retryLockAcquired = await acquireCourseDeletionLock(
      ctx.redisExec,
      id,
      job.id,
      COURSE_DELETION_STATUS_TTL_SECONDS
    )
    if (!retryLockAcquired) {
      await deleteCourseDeletionJob(ctx.redisExec, job.id)
      throw new GraphQLError('Course is currently being changed', {
        extensions: { code: 'COURSE_MUTATION_IN_PROGRESS' },
      })
    }
  }

  // The Redis deletion lock excludes all request-scoped mutation leases. Read
  // the destructive scope only after acquiring it so a mutation that completed
  // during start-up is included, while later mutations are rejected.
  const preparedJob = await snapshotCourseDeletionScope(ctx, job)
  if (!preparedJob) {
    await releaseCourseDeletionLockValue(ctx.redisExec, lockKey, job.id)
    await deleteCourseDeletionJob(ctx.redisExec, job.id)
    return null
  }
  job = preparedJob

  const publishedJob = await publishCourseDeletionEventKeepingPending(ctx, job)

  return getPublicCourseDeletionStatus(publishedJob)
}

export async function getCourseDeletionStatuses(
  { ids }: { ids: string[] },
  ctx: ContextWithUser
) {
  const uniqueIds = [...new Set(ids)].slice(0, 50)
  const jobs = await Promise.all(
    uniqueIds.map((jobId) => getCourseDeletionJob(ctx.redisExec, jobId))
  )
  const statuses: CourseDeletionStatus[] = []

  for (let index = 0; index < uniqueIds.length; index++) {
    const jobId = uniqueIds[index]!
    const job = jobs[index]
    if (!job) {
      const pendingCourse = await ctx.prisma.course.findFirst({
        where: {
          deletionJobId: jobId,
          deletionRequestedById: ctx.user.sub,
          isDeleted: false,
          isDeletionPending: true,
        },
        select: { deletionPendingAt: true, id: true, name: true },
      })
      if (!pendingCourse) continue

      const pendingAt = pendingCourse.deletionPendingAt ?? new Date()
      statuses.push({
        id: jobId,
        status: 'PENDING',
        isQueued: true,
        courseId: pendingCourse.id,
        courseName: pendingCourse.name,
        errorType: null,
        errorMessage: null,
        createdAt: pendingAt,
        updatedAt: pendingAt,
      })
      continue
    }
    if (job.userId !== ctx.user.sub) continue

    const normalizedJob = await normalizeStaleCourseDeletionJob(
      ctx.redisExec,
      ctx,
      job,
      console.warn
    )
    statuses.push(getPublicCourseDeletionStatus(normalizedJob))
  }

  return statuses
}

export const handleProcessCourseDeletion: HatchetHandlers['handleProcessCourseDeletion'] =
  async ({ jobId }, globalCtx, executionCtx) => {
    const redis = globalCtx.redisExec
    const pendingJob = await getCourseDeletionJob(redis, jobId)

    if (!pendingJob) {
      executionCtx.logger.warn(
        `Course deletion job ${jobId} disappeared before processing.`
      )
      return false
    }

    if (isTerminalCourseDeletionStatus(pendingJob.status)) {
      await releaseCourseDeletionCourseLock(redis, pendingJob)
      return pendingJob.status === 'COMPLETED'
    }

    if (!pendingJob.userRole || !pendingJob.userScope) {
      executionCtx.logger.warn(
        `Course deletion job ${jobId} has no stored user context.`
      )
      return false
    }

    const processLockKey = getCourseDeletionProcessLockKey(jobId)
    const processLockValue = randomUUID()
    const processLockAcquired = await redis.set(
      processLockKey,
      processLockValue,
      'EX',
      COURSE_DELETION_PROCESS_LOCK_TTL_SECONDS,
      'NX'
    )

    if (processLockAcquired !== 'OK') {
      throw new GraphQLError('Course deletion job is already being processed', {
        extensions: { code: 'COURSE_DELETION_ALREADY_PROCESSING' },
      })
    }

    const currentJob = await getCourseDeletionJob(redis, jobId)
    if (!currentJob || isTerminalCourseDeletionStatus(currentJob.status)) {
      await releaseCourseDeletionLockValue(
        redis,
        processLockKey,
        processLockValue
      )
      if (currentJob) await releaseCourseDeletionCourseLock(redis, currentJob)
      return currentJob?.status === 'COMPLETED'
    }

    await renewCourseDeletionHeartbeat(redis, jobId)
    let processLeaseLost = false
    const processLockRenewal = setInterval(() => {
      void (async () => {
        const renewed = await renewCourseDeletionProcessLock(
          redis,
          processLockKey,
          processLockValue
        )
        if (!renewed) {
          processLeaseLost = true
          executionCtx.logger.warn(
            `Course deletion job ${jobId} lost its process lease.`
          )
          return
        }
        await renewCourseDeletionHeartbeat(redis, jobId)
      })().catch((error) => {
        executionCtx.logger.warn(
          `Course deletion job ${jobId} lease renewal failed: ${getErrorMessage(error)}`
        )
      })
    }, COURSE_DELETION_PROCESS_LOCK_RENEWAL_MS)

    let job = currentJob

    try {
      if (!hasCourseDeletionLoginScope(job.userScope)) {
        await clearCourseDeletionPending(globalCtx.prisma, {
          courseId: job.courseId,
          jobId: job.id,
        })
        await updateCourseDeletionJobForProcess(
          redis,
          job,
          {
            status: 'FAILED',
            errorType: 'access',
            errorMessage: 'Course deletion requires full account access.',
          },
          processLockKey,
          processLockValue
        )
        return false
      }

      const existingCourse = await globalCtx.prisma.course.findUnique({
        where: { id: job.courseId },
        select: {
          id: true,
          isDeleted: true,
          isAssessmentEnabled: true,
          liveQuizzes: {
            select: {
              id: true,
              isDeleted: true,
              status: true,
              scheduledPublicationTaskId: true,
            },
          },
          practiceQuizzes: {
            select: {
              id: true,
              isDeleted: true,
              status: true,
              scheduledPublicationTaskId: true,
            },
          },
          microLearnings: {
            select: {
              id: true,
              isDeleted: true,
              status: true,
              scheduledCompletionTaskId: true,
              scheduledPublicationTaskId: true,
            },
          },
          groupActivities: {
            select: {
              id: true,
              isDeleted: true,
              status: true,
              scheduledCompletionTaskId: true,
              scheduledPublicationTaskId: true,
            },
          },
        },
      })

      if (!existingCourse || existingCourse.isDeleted) {
        await recoverCourseDeletionPostCommit(job, globalCtx, (message) =>
          executionCtx.logger.warn(message)
        )
        await updateCourseDeletionJobForProcess(
          redis,
          job,
          { status: 'COMPLETED' },
          processLockKey,
          processLockValue
        )
        return true
      }

      await ensureCourseDeletionPending(globalCtx.prisma, job)

      if (existingCourse.isAssessmentEnabled) {
        await releaseCourseDeletionResponseFences(
          redis,
          job.liveQuizIds ?? [],
          job.id
        )
        await clearCourseDeletionPending(globalCtx.prisma, {
          courseId: job.courseId,
          jobId: job.id,
        })
        await updateCourseDeletionJobForProcess(
          redis,
          job,
          {
            status: 'FAILED',
            errorType: 'notAllowed',
            errorMessage: 'Assessment courses cannot be deleted.',
          },
          processLockKey,
          processLockValue
        )
        return false
      }

      const scheduledTaskIds = [
        ...existingCourse.liveQuizzes.map(
          (activity) => activity.scheduledPublicationTaskId
        ),
        ...existingCourse.practiceQuizzes.map(
          (activity) => activity.scheduledPublicationTaskId
        ),
        ...existingCourse.microLearnings.flatMap((activity) => [
          activity.scheduledPublicationTaskId,
          activity.scheduledCompletionTaskId,
        ]),
        ...existingCourse.groupActivities.flatMap((activity) => [
          activity.scheduledPublicationTaskId,
          activity.scheduledCompletionTaskId,
        ]),
      ].filter((taskId): taskId is string => Boolean(taskId))
      job = await updateCourseDeletionJobForProcess(
        redis,
        job,
        {
          status: 'RUNNING',
          retryProtectedUntil: undefined,
          scheduledTaskIds: [...new Set(scheduledTaskIds)],
          liveQuizIds: existingCourse.liveQuizzes.map(
            (activity) => activity.id
          ),
        },
        processLockKey,
        processLockValue
      )

      const ctx = {
        prisma: globalCtx.prisma,
        redisExec: globalCtx.redisExec,
        redisAssessmentExec: globalCtx.redisAssessmentExec,
        pubSub: globalCtx.pubSub,
        emitter: globalCtx.emitter,
        hatchet: globalCtx.hatchet,
        tasks: globalCtx.tasks,
        req: undefined as never,
        res: undefined as never,
        user: {
          sub: job.userId,
          role: job.userRole,
          scope: job.userScope,
          catalystInstitutional: job.catalystInstitutional,
          catalystIndividual: job.catalystIndividual,
        },
      } satisfies ContextWithUser

      const hasDeletionAccess = await hasCourseDeletionAdminAccess(
        globalCtx.prisma,
        {
          courseId: job.courseId,
          deletionJobId: job.id,
          userId: job.userId,
        }
      )
      if (!hasDeletionAccess) {
        await releaseCourseDeletionResponseFences(
          redis,
          job.liveQuizIds ?? [],
          job.id
        )
        throw new GraphQLError('Course deletion access denied', {
          extensions: { code: 'FORBIDDEN' },
        })
      }

      if (
        processLeaseLost ||
        !(await renewCourseDeletionProcessLock(
          redis,
          processLockKey,
          processLockValue
        ))
      ) {
        processLeaseLost = true
        throw new GraphQLError('Course deletion process lease was lost', {
          extensions: { code: 'COURSE_DELETION_PROCESS_LEASE_LOST' },
        })
      }
      await renewCourseDeletionHeartbeat(redis, jobId)

      await waitForCourseDeletionResponseAdmissions(
        globalCtx.prisma,
        job.courseId
      )
      await waitForCourseDeletionResponseFences(
        redis,
        job.liveQuizIds ?? [],
        job.id,
        COURSE_DELETION_STATUS_TTL_SECONDS
      )

      await deleteCourse(
        {
          deletionJobId: job.id,
          id: job.courseId,
          deleteDraftActivities: job.deleteDraftActivities ?? false,
          draftActivityIds: job.draftActivityIds,
        },
        ctx
      )
      await updateCourseDeletionJobForProcess(
        redis,
        job,
        { status: 'COMPLETED' },
        processLockKey,
        processLockValue
      )
      return true
    } catch (error) {
      executionCtx.logger.error(
        `Course deletion job ${jobId} failed: ${getErrorMessage(error)}`
      )

      const remainingCourse = await globalCtx.prisma.course.findUnique({
        where: { id: job.courseId },
        select: { id: true, isDeleted: true },
      })
      if (!remainingCourse || remainingCourse.isDeleted) {
        await recoverCourseDeletionPostCommit(job, globalCtx, (message) =>
          executionCtx.logger.warn(message)
        )
        await updateCourseDeletionJobForProcess(
          redis,
          job,
          { status: 'COMPLETED' },
          processLockKey,
          processLockValue
        )
        return true
      }

      const errorType = getCourseDeletionErrorType(error)
      if (errorType === 'generic') {
        if (
          error instanceof GraphQLError &&
          error.extensions.code === 'COURSE_DELETION_RESPONSE_ADMISSION_PENDING'
        ) {
          // A response won the database race after the preflight check. Let its
          // worker reacquire the Redis lease before Hatchet retries deletion.
          await releaseCourseDeletionResponseFences(
            redis,
            job.liveQuizIds ?? [],
            job.id
          )
        }
        try {
          job = (await protectCourseDeletionRetry(redis, job)) ?? job
        } catch (protectionError) {
          executionCtx.logger.warn(
            `Failed to protect course deletion job ${jobId} for retry: ${getErrorMessage(protectionError)}`
          )
        }
        throw error
      }

      await releaseCourseDeletionResponseFences(
        redis,
        job.liveQuizIds ?? [],
        job.id
      )
      await clearCourseDeletionPending(globalCtx.prisma, {
        courseId: job.courseId,
        jobId: job.id,
      })

      await updateCourseDeletionJobForProcess(
        redis,
        job,
        {
          status: 'FAILED',
          errorType,
          errorMessage:
            'Course deletion failed because the required access is missing.',
        },
        processLockKey,
        processLockValue
      )
      return false
    } finally {
      clearInterval(processLockRenewal)
      await releaseCourseDeletionLockValue(
        redis,
        processLockKey,
        processLockValue
      )
    }
  }

export const handleSweepStaleCourseDeletions: HatchetHandlers['handleSweepStaleCourseDeletions'] =
  async (_, globalCtx, executionCtx) => {
    const redis = globalCtx.redisExec
    const admissionReconciliation =
      await reconcileTerminalLiveQuizResponseAdmissions(globalCtx, (message) =>
        executionCtx.logger.warn(message)
      )
    let cursor = '0'
    let scannedJobs = 0
    let normalizedJobs = 0
    let restoredCourses = 0

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        getCourseDeletionStatusKey('*'),
        'COUNT',
        100
      )
      cursor = nextCursor

      for (const key of keys) {
        if (key.endsWith(':processing') || key.endsWith(':heartbeat')) continue

        let job = parseCourseDeletionJob(await redis.get(key))
        if (!job || isTerminalCourseDeletionStatus(job.status)) continue

        scannedJobs += 1

        const now = Date.now()
        const lastPublicationAttemptAt =
          job.lastPublicationAttemptAt ?? job.createdAt.getTime()
        if (
          job.status === 'PENDING' &&
          job.publicationRecoveryNeeded &&
          now - job.createdAt.getTime() < COURSE_DELETION_STALE_AFTER_MS &&
          now - lastPublicationAttemptAt >= COURSE_DELETION_REPUBLISH_AFTER_MS
        ) {
          const claimedJob =
            await transitionPendingCourseDeletionPublicationRecovery(
              redis,
              job,
              {
                publicationRecoveryNeeded: true,
                publicationRecoveryAttempts:
                  (job.publicationRecoveryAttempts ?? 0) + 1,
                lastPublicationAttemptAt: now,
              }
            )

          if (claimedJob) {
            job = claimedJob
            try {
              await publishCourseDeletionEvent(globalCtx.hatchet, job.id)
              await ensureCourseDeletionPending(globalCtx.prisma, job)
              job =
                (await transitionPendingCourseDeletionPublicationRecovery(
                  redis,
                  job,
                  {
                    publicationRecoveryNeeded: false,
                    publicationRecoveryAttempts:
                      job.publicationRecoveryAttempts ?? 0,
                    lastPublicationAttemptAt: job.lastPublicationAttemptAt,
                  }
                )) ?? job
            } catch (error) {
              executionCtx.logger.warn(
                `Recovery publication failed for course deletion job ${job.id}: ${getErrorMessage(error)}`
              )
            }
          }
        }

        const normalizedJob = await normalizeStaleCourseDeletionJob(
          redis,
          globalCtx,
          job,
          (message) => executionCtx.logger.warn(message)
        )
        if (isTerminalCourseDeletionStatus(normalizedJob.status)) {
          normalizedJobs += 1
        }
      }
    } while (cursor !== '0')

    const stalePendingCourses = await globalCtx.prisma.course.findMany({
      where: {
        deletionJobId: { not: null },
        deletionPendingAt: {
          lte: new Date(Date.now() - COURSE_DELETION_STALE_AFTER_MS),
        },
        isDeleted: false,
        isDeletionPending: true,
      },
      select: {
        deletionJobId: true,
        id: true,
        liveQuizzes: { select: { id: true } },
      },
    })

    for (const course of stalePendingCourses) {
      const jobId = course.deletionJobId
      if (!jobId) continue

      const [rawJob, processLease, heartbeat] = await Promise.all([
        redis.get(getCourseDeletionStatusKey(jobId)),
        redis.get(getCourseDeletionProcessLockKey(jobId)),
        redis.get(getCourseDeletionHeartbeatKey(jobId)),
      ])
      const job = parseCourseDeletionJob(rawJob)
      if (
        (job && !isTerminalCourseDeletionStatus(job.status)) ||
        processLease ||
        heartbeat
      ) {
        continue
      }

      await releaseCourseDeletionResponseFences(
        redis,
        course.liveQuizzes.map((liveQuiz) => liveQuiz.id),
        jobId
      )
      const cleared = await clearCourseDeletionPending(globalCtx.prisma, {
        courseId: course.id,
        jobId,
      })
      if (!cleared) continue

      await releaseCourseDeletionLockValue(
        redis,
        getCourseDeletionCourseLockKey(course.id),
        jobId
      )
      restoredCourses += 1
      executionCtx.logger.warn(
        `Restored course ${course.id} after deletion job ${jobId} disappeared from Redis.`
      )
    }

    if (
      admissionReconciliation.inspectedAdmissions > 0 ||
      scannedJobs > 0 ||
      restoredCourses > 0
    ) {
      executionCtx.logger.info(
        `Course deletion sweep inspected ${scannedJobs} non-terminal jobs, normalized ${normalizedJobs}, restored ${restoredCourses} courses with missing jobs, and terminalized ${admissionReconciliation.terminalizedAdmissions} of ${admissionReconciliation.inspectedAdmissions} stale response admissions.`
      )
    }

    return true
  }
