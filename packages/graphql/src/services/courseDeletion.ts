import { randomUUID } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import type { HatchetHandlers } from '@klicker-uzh/types'
import { getLiveQuizCourseDeletedKey } from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import type { Redis } from 'ioredis'
import type { ContextWithUser } from '../lib/context.js'
import {
  acquireCourseDeletionLock,
  getCourseDeletionCourseLockKey,
  getCourseDeletionStatusKey,
  isTerminalCourseDeletionStatus,
} from './courseDeletionGuard.js'
import { deleteCourse } from './courses.js'
import { checkAccess } from './sharing.js'

const COURSE_DELETION_STATUS_TTL_SECONDS = 24 * 60 * 60
const COURSE_DELETION_STALE_AFTER_MS = 75 * 60 * 1000
const COURSE_DELETION_REPUBLISH_AFTER_MS = 5 * 60 * 1000
const COURSE_DELETION_PROCESS_LOCK_TTL_SECONDS = 60
const COURSE_DELETION_PROCESS_LOCK_RENEWAL_MS = 15 * 1000
const COURSE_DELETION_HEARTBEAT_TTL_SECONDS = 120

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
  draftActivityIds?: {
    liveQuizIds: string[]
    practiceQuizIds: string[]
    microLearningIds: string[]
    groupActivityIds: string[]
  }
  liveQuizIds?: string[]
  lastPublicationAttemptAt?: number
  publicationRecoveryAttempts?: number
  publicationRecoveryNeeded?: boolean
  scheduledTaskIds?: string[]
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
  return getGraphQLErrorCode(error) === 'FORBIDDEN' ? 'access' : 'generic'
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
  ctx: Pick<ContextWithUser, 'hatchet' | 'redisExec'>,
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
    console.warn(
      `Course deletion job ${job.id} went stale without a heartbeat; marked FAILED.`
    )
    return failedJob
  }

  return (await getCourseDeletionJob(redis, job.id)) ?? job
}

export async function startCourseDeletion(
  {
    id,
    deleteDraftActivities,
  }: { id: string; deleteDraftActivities?: boolean | null },
  ctx: ContextWithUser
) {
  const hasDeletionAccess = await checkAccess(
    [
      {
        courseId: id,
        minimumPermissionLevel: DB.PermissionLevel.ADMIN,
      },
    ],
    ctx
  )
  if (!hasDeletionAccess) return null

  const course = await ctx.prisma.course.findUnique({
    where: { id, isAssessmentEnabled: false, isDeleted: false },
    select: {
      name: true,
      liveQuizzes: {
        select: { id: true },
      },
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
        const publishedJob = await publishCourseDeletionEventKeepingPending(
          ctx,
          normalizedJob
        )
        return getPublicCourseDeletionStatus(publishedJob)
      }

      return getPublicCourseDeletionStatus(normalizedJob)
    }
  }

  const now = new Date()
  const job: CourseDeletionJob = {
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
    liveQuizIds: course.liveQuizzes.map((liveQuiz) => liveQuiz.id),
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
        const publishedJob = await publishCourseDeletionEventKeepingPending(
          ctx,
          lockedJob
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

  try {
    await persistCourseDeletionResponseFences(
      ctx.redisExec,
      job.liveQuizIds ?? [],
      job.id,
      COURSE_DELETION_STATUS_TTL_SECONDS
    )
  } catch (error) {
    await releaseCourseDeletionLockValue(ctx.redisExec, lockKey, job.id)
    await deleteCourseDeletionJob(ctx.redisExec, job.id)
    throw new GraphQLError('Course deletion could not be started', {
      extensions: { code: 'COURSE_DELETION_START_FAILED' },
      originalError: error instanceof Error ? error : undefined,
    })
  }

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

  for (const job of jobs) {
    if (!job || job.userId !== ctx.user.sub) continue

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

      if (existingCourse.isAssessmentEnabled) {
        await releaseCourseDeletionResponseFences(
          redis,
          job.liveQuizIds ?? [],
          job.id
        )
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
      const getDraftIds = (
        activities: Array<{
          id: string
          isDeleted: boolean
          status: DB.PublicationStatus
        }>
      ) =>
        job.deleteDraftActivities
          ? activities
              .filter(
                (activity) =>
                  !activity.isDeleted &&
                  activity.status === DB.PublicationStatus.DRAFT
              )
              .map((activity) => activity.id)
          : []
      const draftActivityIds = {
        liveQuizIds: getDraftIds(existingCourse.liveQuizzes),
        practiceQuizIds: getDraftIds(existingCourse.practiceQuizzes),
        microLearningIds: getDraftIds(existingCourse.microLearnings),
        groupActivityIds: getDraftIds(existingCourse.groupActivities),
      }

      job = await updateCourseDeletionJobForProcess(
        redis,
        job,
        {
          status: 'RUNNING',
          scheduledTaskIds: [...new Set(scheduledTaskIds)],
          draftActivityIds,
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

      const hasDeletionAccess = await checkAccess(
        [
          {
            courseId: job.courseId,
            minimumPermissionLevel: DB.PermissionLevel.ADMIN,
          },
        ],
        ctx
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

      await deleteCourse(
        {
          id: job.courseId,
          deleteDraftActivities: job.deleteDraftActivities ?? false,
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
      if (errorType === 'generic') throw error

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
    let cursor = '0'
    let scannedJobs = 0
    let normalizedJobs = 0

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

    if (scannedJobs > 0) {
      executionCtx.logger.info(
        `Course deletion sweep inspected ${scannedJobs} non-terminal jobs and normalized ${normalizedJobs}.`
      )
    }

    return true
  }
