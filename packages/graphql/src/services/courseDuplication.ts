import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import * as DB from '@klicker-uzh/prisma/client'
import type { HatchetHandlers } from '@klicker-uzh/types'
import {
  type PrismaTransactionClient,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
import { GraphQLError } from 'graphql'
import type { Redis } from 'ioredis'
import type { ContextWithUser } from '../lib/context.js'
import { getCourseDeletionAdvisoryLockKey } from './courseDeletionGuard.js'
import { type CourseCreationArgs, createCourse } from './courses.js'
import { manipulateGroupActivity } from './groups.js'
import { manipulateLiveQuiz } from './liveQuizzes.js'
import { manipulateMicroLearning } from './microLearning.js'
import { manipulatePracticeQuiz } from './practiceQuizzes.js'
import { checkAccess, type PermissionCheck } from './sharing.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const DUPLICATE_COURSE_TRANSACTION_TIMEOUT = 10 * 60 * 1000
const COURSE_DUPLICATION_TIME_ZONE = 'Europe/Zurich'
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
const COURSE_DUPLICATION_PARTIAL_FAILURE_CODE =
  'COURSE_DUPLICATION_PARTIAL_FAILURE'
const COURSE_DUPLICATION_STATUS_TTL_SECONDS = 24 * 60 * 60
// Pending Hatchet runs may wait up to 60 minutes for the task-local concurrency
// slot. The extra 15 minutes allow cancellation and the five-minute sweep to
// settle. A running attempt refreshes updatedAt when it starts and maintains a
// heartbeat, so queue time cannot make live work stale.
const COURSE_DUPLICATION_STALE_AFTER_MS = 75 * 60 * 1000
const COURSE_DUPLICATION_PROCESS_LOCK_TTL_SECONDS = 60
const COURSE_DUPLICATION_PROCESS_LOCK_RENEWAL_MS = 15 * 1000
// The worker refreshes this key while an attempt is alive; stale normalization
// must never fail a job whose lease is still being renewed.
const COURSE_DUPLICATION_HEARTBEAT_TTL_SECONDS = 120
export const COURSE_DUPLICATION_JOB_STATUS_VALUES = [
  'COMPLETED',
  'FAILED',
  'PENDING',
  'RUNNING',
] as const
const COURSE_DUPLICATION_STATUS_KEY_PREFIX = 'course-duplication:job'
const COURSE_DUPLICATION_SOURCE_LOCK_KEY_PREFIX = 'course-duplication:source'

function courseDuplicationPartialFailure(message: string) {
  return new GraphQLError(message, {
    extensions: { code: COURSE_DUPLICATION_PARTIAL_FAILURE_CODE },
  })
}

export type CourseDuplicationJobStatus =
  (typeof COURSE_DUPLICATION_JOB_STATUS_VALUES)[number]

export type CourseDuplicationErrorType = 'access' | 'generic' | 'partial'

type CourseDuplicationArgs = Omit<
  CourseCreationArgs,
  'isGamificationEnabled'
> & {
  isGamificationEnabled?: boolean | null
  sourceCourseId?: string | null
  duplicateLiveQuizzes?: boolean | null
  duplicatePracticeQuizzes?: boolean | null
  duplicateMicrolearnings?: boolean | null
  duplicateGroupActivities?: boolean | null
}

type CourseDuplicationJobArgs = Omit<
  CourseDuplicationArgs,
  | 'groupDeadlineDate'
  | 'isGroupCreationEnabled'
  | 'maxGroupSize'
  | 'preferredGroupSize'
  | 'sourceCourseId'
> & {
  groupDeadlineDate: Date
  isGroupCreationEnabled: boolean
  maxGroupSize: number
  preferredGroupSize: number
  sourceCourseId: string
}

export interface CourseDuplicationStatus {
  id: string
  status: CourseDuplicationJobStatus
  sourceCourseId: string
  sourceCourseName: string
  targetCourseName: string
  createdCourseId?: string | null
  errorType?: CourseDuplicationErrorType | null
  errorMessage?: string | null
  createdAt: Date
  updatedAt: Date
}

interface CourseDuplicationJob extends CourseDuplicationStatus {
  userId: string
  userRole: DB.UserRole
  userScope: DB.UserLoginScope
  catalystInstitutional: boolean
  catalystIndividual: boolean
  args?: CourseDuplicationJobArgs
}

function getCourseDuplicationStatusKey(jobId: string) {
  return `${COURSE_DUPLICATION_STATUS_KEY_PREFIX}:${jobId}`
}

function getCourseDuplicationSourceLockKey({
  sourceCourseId,
  userId,
}: {
  sourceCourseId: string
  userId: string
}) {
  return `${COURSE_DUPLICATION_SOURCE_LOCK_KEY_PREFIX}:${userId}:${sourceCourseId}`
}

function getCourseDuplicationProcessLockKey(jobId: string) {
  return `${COURSE_DUPLICATION_STATUS_KEY_PREFIX}:${jobId}:processing`
}

function getCourseDuplicationHeartbeatKey(jobId: string) {
  return `${COURSE_DUPLICATION_STATUS_KEY_PREFIX}:${jobId}:heartbeat`
}

async function renewCourseDuplicationHeartbeat(redis: Redis, jobId: string) {
  const set = await redis.set(
    getCourseDuplicationHeartbeatKey(jobId),
    '1',
    'EX',
    COURSE_DUPLICATION_HEARTBEAT_TTL_SECONDS
  )
  return set === 'OK'
}

async function hasFreshCourseDuplicationHeartbeat(redis: Redis, jobId: string) {
  return (await redis.get(getCourseDuplicationHeartbeatKey(jobId))) === '1'
}

function isTerminalCourseDuplicationStatus(status: CourseDuplicationJobStatus) {
  return status === 'COMPLETED' || status === 'FAILED'
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

function getCourseDuplicationJobErrorType(
  error: unknown
): CourseDuplicationErrorType {
  const code = getGraphQLErrorCode(error)
  if (code === COURSE_DUPLICATION_PARTIAL_FAILURE_CODE) return 'partial'
  if (code === 'FORBIDDEN') return 'access'

  return 'generic'
}

function getCourseDuplicationJobErrorMessage(error: unknown) {
  const errorType = getCourseDuplicationJobErrorType(error)

  switch (errorType) {
    case 'access':
      return 'Course duplication failed because the required access is missing.'
    case 'partial':
      return getErrorMessage(error)
    default:
      return 'Course duplication failed.'
  }
}

function parseCourseDuplicationDate(value: unknown) {
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function parseCourseDuplicationJob(
  rawJob: string | null
): CourseDuplicationJob | null {
  if (!rawJob) return null

  try {
    const parsedJob = JSON.parse(rawJob) as CourseDuplicationJob

    return {
      ...parsedJob,
      createdAt: parseCourseDuplicationDate(parsedJob.createdAt),
      updatedAt: parseCourseDuplicationDate(parsedJob.updatedAt),
      args: parsedJob.args
        ? {
            ...parsedJob.args,
            startDate: parseCourseDuplicationDate(parsedJob.args.startDate),
            endDate: parseCourseDuplicationDate(parsedJob.args.endDate),
            groupDeadlineDate: parseCourseDuplicationDate(
              parsedJob.args.groupDeadlineDate
            ),
          }
        : undefined,
    } satisfies CourseDuplicationJob
  } catch (error) {
    console.error('Failed to parse course duplication job status:', error)
    return null
  }
}

async function getCourseDuplicationJob(redis: Redis, jobId: string) {
  return parseCourseDuplicationJob(
    await redis.get(getCourseDuplicationStatusKey(jobId))
  )
}

// Terminal records no longer need the mutation payload or execution context;
// stripping args keeps user data (notificationEmail rides in args) out of
// Redis while retaining userId for status-read authorization.
function serializeCourseDuplicationJob(job: CourseDuplicationJob): string {
  if (!isTerminalCourseDuplicationStatus(job.status)) {
    return JSON.stringify(job)
  }

  return JSON.stringify({
    id: job.id,
    status: job.status,
    sourceCourseId: job.sourceCourseId,
    sourceCourseName: job.sourceCourseName,
    targetCourseName: job.targetCourseName,
    createdCourseId: job.createdCourseId,
    errorType: job.errorType,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    userId: job.userId,
  } satisfies Pick<
    CourseDuplicationJob,
    keyof CourseDuplicationStatus | 'userId'
  >)
}

async function persistCourseDuplicationJob(
  redis: Redis,
  job: CourseDuplicationJob
) {
  await redis.set(
    getCourseDuplicationStatusKey(job.id),
    serializeCourseDuplicationJob(job),
    'EX',
    COURSE_DUPLICATION_STATUS_TTL_SECONDS
  )
}

async function deleteCourseDuplicationJob(redis: Redis, jobId: string) {
  await redis.del(getCourseDuplicationStatusKey(jobId))
}

async function publishCourseDuplicationEvent(
  hatchet: ContextWithUser['hatchet'],
  jobId: string
) {
  try {
    await hatchet.events.push('process-course-duplication', { jobId })
  } catch (error) {
    // Hatchet may have accepted the event before the client observed an
    // acknowledgement. Retry the same job id so a lost acknowledgement cannot
    // create a second course.
    try {
      await hatchet.events.push('process-course-duplication', { jobId })
    } catch (retryError) {
      const publishError = new Error(
        `Initial publish failed: ${getErrorMessage(error)}; retry failed: ${getErrorMessage(retryError)}`,
        { cause: error instanceof Error ? error : undefined }
      )
      throw new GraphQLError('Course duplication could not be started', {
        extensions: { code: 'COURSE_DUPLICATION_START_FAILED' },
        originalError: publishError,
      })
    }
  }
}

async function releaseCourseDuplicationSourceLock(
  redis: Redis,
  job: CourseDuplicationJob
) {
  const lockKey = getCourseDuplicationSourceLockKey({
    sourceCourseId: job.sourceCourseId,
    userId: job.userId,
  })
  await releaseCourseDuplicationLockValue(redis, lockKey, job.id)
}

async function releaseCourseDuplicationLockValue(
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

async function renewCourseDuplicationProcessLock(
  redis: Redis,
  lockKey: string,
  value: string
) {
  await redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("expire", KEYS[1], ARGV[2])
    end
    return 0`,
    1,
    lockKey,
    value,
    COURSE_DUPLICATION_PROCESS_LOCK_TTL_SECONDS
  )
}

async function updateCourseDuplicationJob(
  redis: Redis,
  job: CourseDuplicationJob,
  patch: Partial<
    Pick<
      CourseDuplicationJob,
      'createdCourseId' | 'errorMessage' | 'errorType' | 'status'
    >
  >
) {
  const updatedJob = {
    ...job,
    ...patch,
    updatedAt: new Date(),
  } satisfies CourseDuplicationJob

  await persistCourseDuplicationJob(redis, updatedJob)

  if (isTerminalCourseDuplicationStatus(updatedJob.status)) {
    await releaseCourseDuplicationSourceLock(redis, updatedJob)
  }

  return updatedJob
}

function getPublicCourseDuplicationStatus(
  job: CourseDuplicationJob
): CourseDuplicationStatus {
  return {
    id: job.id,
    status: job.status,
    sourceCourseId: job.sourceCourseId,
    sourceCourseName: job.sourceCourseName,
    targetCourseName: job.targetCourseName,
    createdCourseId: job.createdCourseId,
    errorType: job.errorType,
    errorMessage: job.errorMessage,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  }
}

// A live attempt refreshes the heartbeat key, so staleness alone must not
// fail a job: require both an old updatedAt and an expired heartbeat. Before
// declaring failure, reconcile against Postgres - the copied course carries
// the job id as its primary key, so a committed row means the copy succeeded
// even when its COMPLETED status write was lost.
async function normalizeStaleCourseDuplicationJob(
  redis: Redis,
  prisma: PrismaClient,
  job: CourseDuplicationJob
) {
  if (
    isTerminalCourseDuplicationStatus(job.status) ||
    Date.now() - job.updatedAt.getTime() < COURSE_DUPLICATION_STALE_AFTER_MS ||
    (await hasFreshCourseDuplicationHeartbeat(redis, job.id))
  ) {
    return job
  }

  const committedCourse = await prisma.course.findUnique({
    where: { id: job.id },
    select: { id: true },
  })

  if (committedCourse) {
    console.warn(
      `Course duplication job ${job.id} went stale but its course is committed; marking COMPLETED.`
    )
    return await updateCourseDuplicationJob(redis, job, {
      status: 'COMPLETED',
      createdCourseId: committedCourse.id,
    })
  }

  console.warn(
    `Course duplication job ${job.id} went stale without a heartbeat; marking FAILED.`
  )
  return await updateCourseDuplicationJob(redis, job, {
    status: 'FAILED',
    errorType: 'generic',
    errorMessage: 'Course duplication did not finish in time.',
  })
}

export async function startCourseDuplication(
  args: CourseDuplicationJobArgs,
  ctx: ContextWithUser
) {
  const hasDuplicationAccess = await checkAccess(
    [
      {
        courseId: args.sourceCourseId,
        minimumPermissionLevel: DB.PermissionLevel.ADMIN,
      },
    ],
    ctx
  )
  if (!hasDuplicationAccess) {
    console.warn(
      `Course duplication denied: user ${ctx.user.sub} lacks ADMIN access to course ${args.sourceCourseId}.`
    )
    return null
  }

  const sourceCourse = await ctx.prisma.course.findUnique({
    where: { id: args.sourceCourseId, isDeleted: false },
    select: { name: true },
  })
  if (!sourceCourse) {
    console.warn(
      `Course duplication denied: source course ${args.sourceCourseId} no longer exists.`
    )
    return null
  }

  const lockKey = getCourseDuplicationSourceLockKey({
    sourceCourseId: args.sourceCourseId,
    userId: ctx.user.sub,
  })
  const existingJobId = await ctx.redisExec.get(lockKey)
  const existingJob = existingJobId
    ? await getCourseDuplicationJob(ctx.redisExec, existingJobId)
    : null

  if (existingJob && !isTerminalCourseDuplicationStatus(existingJob.status)) {
    const normalizedExistingJob = await normalizeStaleCourseDuplicationJob(
      ctx.redisExec,
      ctx.prisma,
      existingJob
    )

    if (!isTerminalCourseDuplicationStatus(normalizedExistingJob.status)) {
      if (normalizedExistingJob.status === 'PENDING') {
        await publishCourseDuplicationEvent(
          ctx.hatchet,
          normalizedExistingJob.id
        )
      }

      return getPublicCourseDuplicationStatus(normalizedExistingJob)
    }
  }

  const now = new Date()
  const job: CourseDuplicationJob = {
    id: randomUUID(),
    status: 'PENDING',
    sourceCourseId: args.sourceCourseId,
    sourceCourseName: sourceCourse.name,
    targetCourseName: args.name,
    createdCourseId: null,
    errorType: null,
    errorMessage: null,
    createdAt: now,
    updatedAt: now,
    userId: ctx.user.sub,
    userRole: ctx.user.role,
    userScope: ctx.user.scope,
    catalystInstitutional: ctx.user.catalystInstitutional,
    catalystIndividual: ctx.user.catalystIndividual,
    args,
  }

  await persistCourseDuplicationJob(ctx.redisExec, job)

  const lockAcquired = await ctx.redisExec.set(
    lockKey,
    job.id,
    'EX',
    COURSE_DUPLICATION_STATUS_TTL_SECONDS,
    'NX'
  )

  if (lockAcquired !== 'OK') {
    const lockedJobId = await ctx.redisExec.get(lockKey)
    const lockedJob = lockedJobId
      ? await getCourseDuplicationJob(ctx.redisExec, lockedJobId)
      : null

    if (lockedJob && !isTerminalCourseDuplicationStatus(lockedJob.status)) {
      await deleteCourseDuplicationJob(ctx.redisExec, job.id)

      if (lockedJob.status === 'PENDING') {
        await publishCourseDuplicationEvent(ctx.hatchet, lockedJob.id)
      }

      return getPublicCourseDuplicationStatus(lockedJob)
    }

    if (lockedJobId) {
      await releaseCourseDuplicationLockValue(
        ctx.redisExec,
        lockKey,
        lockedJobId
      )
    }

    const retryLockAcquired = await ctx.redisExec.set(
      lockKey,
      job.id,
      'EX',
      COURSE_DUPLICATION_STATUS_TTL_SECONDS,
      'NX'
    )

    if (retryLockAcquired !== 'OK') {
      await deleteCourseDuplicationJob(ctx.redisExec, job.id)
      return null
    }
  }

  try {
    await publishCourseDuplicationEvent(ctx.hatchet, job.id)
  } catch (error) {
    try {
      await updateCourseDuplicationJob(ctx.redisExec, job, {
        status: 'FAILED',
        errorType: 'generic',
        errorMessage: 'Course duplication could not be started.',
      })
    } catch (cleanupError) {
      console.error(
        `Failed to clean up course duplication job ${job.id} after publish failure: ${getErrorMessage(cleanupError)}`
      )
      try {
        await releaseCourseDuplicationSourceLock(ctx.redisExec, job)
      } catch (releaseError) {
        console.error(
          `Failed to release course duplication source lock for job ${job.id}: ${getErrorMessage(releaseError)}`
        )
      }
    }

    throw error
  }

  return getPublicCourseDuplicationStatus(job)
}

export async function getCourseDuplicationStatuses(
  { ids }: { ids: string[] },
  ctx: ContextWithUser
) {
  const uniqueIds = [...new Set(ids)].slice(0, 50)
  const jobs = await Promise.all(
    uniqueIds.map((jobId) => getCourseDuplicationJob(ctx.redisExec, jobId))
  )

  const statuses: CourseDuplicationStatus[] = []

  for (const job of jobs) {
    if (!job || job.userId !== ctx.user.sub) continue

    const normalizedJob = await normalizeStaleCourseDuplicationJob(
      ctx.redisExec,
      ctx.prisma,
      job
    )
    statuses.push(getPublicCourseDuplicationStatus(normalizedJob))
  }

  return statuses
}

export const handleProcessCourseDuplication: HatchetHandlers['handleProcessCourseDuplication'] =
  async ({ jobId }, globalCtx, executionCtx) => {
    const redis = globalCtx.redisExec
    const pendingJob = await getCourseDuplicationJob(redis, jobId)

    if (!pendingJob) {
      executionCtx.logger.warn(
        `Course duplication job ${jobId} disappeared before processing.`
      )
      return false
    }

    if (isTerminalCourseDuplicationStatus(pendingJob.status)) {
      if (pendingJob.status === 'COMPLETED') {
        await releaseCourseDuplicationSourceLock(redis, pendingJob)
      }
      return true
    }

    if (!pendingJob.args) {
      executionCtx.logger.warn(
        `Course duplication job ${jobId} has no stored arguments; cannot process.`
      )
      return false
    }
    const duplicationArgs = pendingJob.args

    const processLockKey = getCourseDuplicationProcessLockKey(pendingJob.id)
    const processLockValue = randomUUID()
    const processLockAcquired = await redis.set(
      processLockKey,
      processLockValue,
      'EX',
      COURSE_DUPLICATION_PROCESS_LOCK_TTL_SECONDS,
      'NX'
    )

    if (processLockAcquired !== 'OK') {
      throw new Error('Course duplication job is already being processed')
    }

    await renewCourseDuplicationHeartbeat(redis, jobId)

    const processLockRenewal = setInterval(() => {
      void renewCourseDuplicationProcessLock(
        redis,
        processLockKey,
        processLockValue
      ).catch((error) => {
        executionCtx.logger.warn(
          `Course duplication job ${jobId} process lock renewal failed: ${getErrorMessage(error)}`
        )
      })
      void renewCourseDuplicationHeartbeat(redis, jobId).catch((error) => {
        executionCtx.logger.warn(
          `Course duplication job ${jobId} heartbeat renewal failed: ${getErrorMessage(error)}`
        )
      })
    }, COURSE_DUPLICATION_PROCESS_LOCK_RENEWAL_MS)

    let job = pendingJob
    let committedCourseId: string | null = null

    try {
      const existingCourse = await globalCtx.prisma.course.findUnique({
        where: { id: job.id },
        select: { id: true },
      })

      if (existingCourse) {
        committedCourseId = existingCourse.id
        await updateCourseDuplicationJob(redis, job, {
          status: 'COMPLETED',
          createdCourseId: existingCourse.id,
        })
        return true
      }

      job = await updateCourseDuplicationJob(redis, job, { status: 'RUNNING' })

      const duplicatedCourse = await duplicateCourse(
        { ...duplicationArgs, courseId: job.id },
        {
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
        }
      )

      if (!duplicatedCourse) {
        throw new GraphQLError('Course duplication access denied', {
          extensions: { code: 'FORBIDDEN' },
        })
      }

      committedCourseId = duplicatedCourse.id
      await updateCourseDuplicationJob(redis, job, {
        status: 'COMPLETED',
        createdCourseId: duplicatedCourse.id,
      })

      return true
    } catch (error) {
      executionCtx.logger.error(
        `Course duplication job ${jobId} failed: ${getErrorMessage(error)}`
      )

      const errorType = getCourseDuplicationJobErrorType(error)

      if (committedCourseId || errorType === 'generic') {
        executionCtx.logger.error(
          committedCourseId
            ? `Course duplication job ${jobId} committed course ${committedCourseId}; leaving the job retryable.`
            : `Course duplication job ${jobId} encountered a retryable error.`
        )
        throw error
      }

      try {
        await updateCourseDuplicationJob(redis, job, {
          status: 'FAILED',
          errorType,
          errorMessage: getCourseDuplicationJobErrorMessage(error),
        })
      } catch (statusUpdateError) {
        executionCtx.logger.error(
          `Failed to mark course duplication job ${jobId} as FAILED: ${getErrorMessage(statusUpdateError)}`
        )
        try {
          await releaseCourseDuplicationSourceLock(redis, job)
        } catch (releaseError) {
          executionCtx.logger.error(
            `Failed to release course duplication source lock for job ${jobId}: ${getErrorMessage(releaseError)}`
          )
        }
      }

      return false
    } finally {
      clearInterval(processLockRenewal)
      await releaseCourseDuplicationLockValue(
        redis,
        processLockKey,
        processLockValue
      )
    }
  }

export const handleSweepStaleCourseDuplications: HatchetHandlers['handleSweepStaleCourseDuplications'] =
  async (_, globalCtx, executionCtx) => {
    const redis = globalCtx.redisExec
    let cursor = '0'
    let scannedJobs = 0
    let normalizedJobs = 0

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        `${COURSE_DUPLICATION_STATUS_KEY_PREFIX}:*`,
        'COUNT',
        100
      )
      cursor = nextCursor

      for (const key of keys) {
        // Skip lease and heartbeat keys sharing the status-key prefix.
        if (key.endsWith(':processing') || key.endsWith(':heartbeat')) {
          continue
        }

        const job = parseCourseDuplicationJob(await redis.get(key))
        if (!job || isTerminalCourseDuplicationStatus(job.status)) continue

        scannedJobs += 1
        const normalizedJob = await normalizeStaleCourseDuplicationJob(
          redis,
          globalCtx.prisma,
          job
        )

        if (isTerminalCourseDuplicationStatus(normalizedJob.status)) {
          normalizedJobs += 1
        }
      }
    } while (cursor !== '0')

    if (scannedJobs > 0) {
      executionCtx.logger.info(
        `Course duplication sweep inspected ${scannedJobs} non-terminal jobs and normalized ${normalizedJobs}.`
      )
    }

    return true
  }

type CourseDuplicationPermissionTarget =
  | { courseId: string }
  | { liveQuizId: string }
  | { practiceQuizId: string }
  | { microLearningId: string }
  | { groupActivityId: string }

function getPermissionTargetObjectId(
  target: CourseDuplicationPermissionTarget
) {
  if ('courseId' in target) return target.courseId
  if ('liveQuizId' in target) return target.liveQuizId
  if ('practiceQuizId' in target) return target.practiceQuizId
  if ('microLearningId' in target) return target.microLearningId
  return target.groupActivityId
}

const courseDuplicationInclude = {
  directPermissions: true,
  practiceQuizzes: {
    where: { isDeleted: false },
    include: {
      directPermissions: true,
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  },
  liveQuizzes: {
    where: { isDeleted: false },
    include: {
      directPermissions: true,
      blocks: {
        include: {
          elements: true,
        },
      },
    },
  },
  microLearnings: {
    where: { isDeleted: false },
    include: {
      directPermissions: true,
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  },
  groupActivities: {
    where: { isDeleted: false },
    include: {
      directPermissions: true,
      stacks: {
        include: {
          elements: true,
        },
      },
      clues: true,
    },
  },
} satisfies DB.Prisma.CourseInclude

type CourseDuplicationSourceCourse = DB.Prisma.CourseGetPayload<{
  include: typeof courseDuplicationInclude
}>

type CourseDuplicationLiveQuiz =
  CourseDuplicationSourceCourse['liveQuizzes'][number]
type CourseDuplicationPracticeQuiz =
  CourseDuplicationSourceCourse['practiceQuizzes'][number]
type CourseDuplicationMicroLearning =
  CourseDuplicationSourceCourse['microLearnings'][number]
type CourseDuplicationGroupActivity =
  CourseDuplicationSourceCourse['groupActivities'][number]

type CourseDuplicationActivityIds = {
  liveQuizIds: Map<string, string>
  practiceQuizIds: Map<string, string>
  microLearningIds: Map<string, string>
  groupActivityIds: Map<string, string>
}

function getDuplicatedActivityElements(
  elements: { elementId: number; order: number; id: number }[]
) {
  return elements.map((element) => ({
    elementId: element.elementId,
    order: element.order,
    existingInstanceId: element.id,
    duplicateInstance: true,
  }))
}

export function applyCourseStartDelta(date: Date, deltaCourseStart: number) {
  return dayjs(date)
    .tz(COURSE_DUPLICATION_TIME_ZONE)
    .add(deltaCourseStart, 'day')
    .tz(COURSE_DUPLICATION_TIME_ZONE, true)
    .toDate()
}

export function getCourseStartDayDelta(newStartDate: Date, oldStartDate: Date) {
  const getLocalCalendarDate = (date: Date) => {
    const localDate = dayjs(date).tz(COURSE_DUPLICATION_TIME_ZONE)
    return Date.UTC(localDate.year(), localDate.month(), localDate.date())
  }

  return Math.round(
    (getLocalCalendarDate(newStartDate) - getLocalCalendarDate(oldStartDate)) /
      MILLISECONDS_PER_DAY
  )
}

async function copyCourseDuplicationDirectPermissions({
  sourcePermissions,
  sourceObjectType,
  sourceObjectId,
  targetObjectType,
  target,
  ctx,
  prisma,
}: {
  sourcePermissions: DB.Permission[]
  sourceObjectType: DB.ObjectType
  sourceObjectId: string
  targetObjectType: DB.ObjectType
  target: CourseDuplicationPermissionTarget
  ctx: ContextWithUser
  prisma: PrismaTransactionClient
}) {
  const targetObjectId = getPermissionTargetObjectId(target)

  for (const permission of sourcePermissions) {
    if (
      permission.userId === ctx.user.sub ||
      (!permission.userId && !permission.userGroupId)
    ) {
      continue
    }

    const copiedPermission = await prisma.permission.create({
      data: {
        permissionLevel: permission.permissionLevel,
        propagation: permission.propagation,
        userId: permission.userId,
        userGroupId: permission.userGroupId,
        ...target,
      },
    })

    await prisma.auditLogEntry.create({
      data: {
        type: DB.AuditLogType.PERMISSION_GRANTED,
        objectType: targetObjectType,
        objectId: targetObjectId,
        sourceUserId: ctx.user.sub,
        targetUserId: permission.userId,
        targetUserGroupId: permission.userGroupId,
        message: `Direct permission with level ${permission.permissionLevel} copied during course duplication from ${sourceObjectType} (ID ${sourceObjectId}) to ${targetObjectType} (ID ${targetObjectId}) by user ${ctx.user.sub}.`,
      },
    })

    ctx.emitter.emit('invalidate', {
      typename: 'Permission',
      id: copiedPermission.id,
    })
  }
}

async function grantDuplicatedCourseAccessToSourceOwner({
  sourceCourseId,
  sourceOwnerId,
  targetCourseId,
  ctx,
  prisma,
}: {
  sourceCourseId: string
  sourceOwnerId: string
  targetCourseId: string
  ctx: ContextWithUser
  prisma: PrismaTransactionClient
}) {
  if (sourceOwnerId === ctx.user.sub) return

  const copiedPermission = await prisma.permission.upsert({
    where: {
      courseId_userId: {
        courseId: targetCourseId,
        userId: sourceOwnerId,
      },
    },
    create: {
      permissionLevel: DB.PermissionLevel.ADMIN,
      propagation: false,
      courseId: targetCourseId,
      userId: sourceOwnerId,
    },
    update: {
      permissionLevel: DB.PermissionLevel.ADMIN,
      propagation: false,
    },
  })

  await prisma.auditLogEntry.create({
    data: {
      type: DB.AuditLogType.PERMISSION_GRANTED,
      objectType: DB.ObjectType.COURSE,
      objectId: targetCourseId,
      sourceUserId: ctx.user.sub,
      targetUserId: sourceOwnerId,
      message: `Source course owner ${sourceOwnerId} kept ADMIN access during course duplication from COURSE (ID ${sourceCourseId}) to COURSE (ID ${targetCourseId}) by user ${ctx.user.sub}.`,
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'Permission',
    id: copiedPermission.id,
  })
}

async function copyCourseLiveQuizzes({
  liveQuizzes,
  newCourseId,
  ctx,
  prisma,
}: {
  liveQuizzes: CourseDuplicationLiveQuiz[]
  newCourseId: string
  ctx: ContextWithUser
  prisma: PrismaTransactionClient
}) {
  const copiedLiveQuizIdBySourceId = new Map<string, string>()

  for (const oldLiveQuiz of liveQuizzes) {
    const copiedLiveQuiz = await manipulateLiveQuiz(
      {
        name: oldLiveQuiz.name,
        displayName: oldLiveQuiz.displayName,
        description: oldLiveQuiz.description,
        blocks: oldLiveQuiz.blocks.map((block) => ({
          order: block.order,
          timeLimit: block.timeLimit,
          randomSelection: block.randomSelection,
          elements: getDuplicatedActivityElements(block.elements),
        })),
        courseId: newCourseId,
        multiplier: oldLiveQuiz.pointsMultiplier,
        defaultPoints: oldLiveQuiz.defaultPoints,
        defaultCorrectPoints: oldLiveQuiz.defaultCorrectPoints,
        maxBonusPoints: oldLiveQuiz.maxBonusPoints,
        timeToZeroBonus: oldLiveQuiz.timeToZeroBonus,
        isGamificationEnabled: oldLiveQuiz.isGamificationEnabled,
        isPinProtected: !!oldLiveQuiz.pinCode,
        isConfusionFeedbackEnabled: oldLiveQuiz.isConfusionFeedbackEnabled,
        isLiveQAEnabled: oldLiveQuiz.isLiveQAEnabled,
        isModerationEnabled: oldLiveQuiz.isModerationEnabled,
      },
      ctx,
      prisma
    )

    copiedLiveQuizIdBySourceId.set(oldLiveQuiz.id, copiedLiveQuiz.id)

    await prisma.liveQuiz.update({
      where: { id: copiedLiveQuiz.id },
      data: { accessMode: oldLiveQuiz.accessMode },
    })
  }

  return copiedLiveQuizIdBySourceId
}

async function copyCoursePracticeQuizzes({
  practiceQuizzes,
  newCourseId,
  ctx,
  prisma,
}: {
  practiceQuizzes: CourseDuplicationPracticeQuiz[]
  newCourseId: string
  ctx: ContextWithUser
  prisma: PrismaTransactionClient
}) {
  const copiedPracticeQuizIdBySourceId = new Map<string, string>()

  for (const oldPracticeQuiz of practiceQuizzes) {
    const copiedPracticeQuiz = await manipulatePracticeQuiz(
      {
        name: oldPracticeQuiz.name,
        displayName: oldPracticeQuiz.displayName,
        description: oldPracticeQuiz.description,
        stacks: oldPracticeQuiz.stacks.map((stack) => ({
          order: stack.order,
          displayName: stack.displayName,
          description: stack.description,
          elements: getDuplicatedActivityElements(stack.elements),
        })),
        courseId: newCourseId,
        multiplier: oldPracticeQuiz.pointsMultiplier,
        order: oldPracticeQuiz.orderType,
        resetTimeDays: oldPracticeQuiz.resetTimeDays,
      },
      ctx,
      prisma
    )

    copiedPracticeQuizIdBySourceId.set(
      oldPracticeQuiz.id,
      copiedPracticeQuiz.id
    )
  }

  return copiedPracticeQuizIdBySourceId
}

async function copyCourseMicroLearnings({
  microLearnings,
  newCourseId,
  deltaCourseStart,
  ctx,
  prisma,
}: {
  microLearnings: CourseDuplicationMicroLearning[]
  newCourseId: string
  deltaCourseStart: number
  ctx: ContextWithUser
  prisma: PrismaTransactionClient
}) {
  const copiedMicroLearningIdBySourceId = new Map<string, string>()

  for (const oldMicroLearning of microLearnings) {
    const copiedMicroLearning = await manipulateMicroLearning(
      {
        name: oldMicroLearning.name,
        displayName: oldMicroLearning.displayName,
        description: oldMicroLearning.description,
        stacks: oldMicroLearning.stacks.map((stack) => ({
          order: stack.order,
          displayName: stack.displayName,
          description: stack.description,
          elements: getDuplicatedActivityElements(stack.elements),
        })),
        courseId: newCourseId,
        multiplier: oldMicroLearning.pointsMultiplier,
        startDate: applyCourseStartDelta(
          oldMicroLearning.scheduledStartAt,
          deltaCourseStart
        ),
        endDate: applyCourseStartDelta(
          oldMicroLearning.scheduledEndAt,
          deltaCourseStart
        ),
      },
      ctx,
      prisma
    )

    copiedMicroLearningIdBySourceId.set(
      oldMicroLearning.id,
      copiedMicroLearning.id
    )
  }

  return copiedMicroLearningIdBySourceId
}

async function copyCourseGroupActivities({
  groupActivities,
  newCourseId,
  deltaCourseStart,
  ctx,
  prisma,
}: {
  groupActivities: CourseDuplicationGroupActivity[]
  newCourseId: string
  deltaCourseStart: number
  ctx: ContextWithUser
  prisma: PrismaTransactionClient
}) {
  const copiedGroupActivityIdBySourceId = new Map<string, string>()

  for (const oldGroupActivity of groupActivities) {
    const stack = oldGroupActivity.stacks[0]

    if (!stack) {
      throw courseDuplicationPartialFailure(
        'Not all group activities could be duplicated'
      )
    }

    const copiedGroupActivity = await manipulateGroupActivity(
      {
        name: oldGroupActivity.name,
        displayName: oldGroupActivity.displayName,
        description: oldGroupActivity.description,
        stack: {
          order: stack.order,
          displayName: stack.displayName,
          description: stack.description,
          elements: getDuplicatedActivityElements(stack.elements),
        },
        courseId: newCourseId,
        multiplier: oldGroupActivity.pointsMultiplier,
        clues: oldGroupActivity.clues,
        startDate: applyCourseStartDelta(
          oldGroupActivity.scheduledStartAt,
          deltaCourseStart
        ),
        endDate: applyCourseStartDelta(
          oldGroupActivity.scheduledEndAt,
          deltaCourseStart
        ),
      },
      ctx,
      prisma
    )

    copiedGroupActivityIdBySourceId.set(
      oldGroupActivity.id,
      copiedGroupActivity.id
    )
  }

  return copiedGroupActivityIdBySourceId
}

async function duplicateSelectedCourseActivities({
  oldCourse,
  newCourseId,
  startDate,
  duplicateLiveQuizzes,
  duplicatePracticeQuizzes,
  duplicateMicrolearnings,
  shouldDuplicateGroupActivities,
  ctx,
  prisma,
}: {
  oldCourse: CourseDuplicationSourceCourse
  newCourseId: string
  startDate: Date
  duplicateLiveQuizzes?: boolean | null
  duplicatePracticeQuizzes?: boolean | null
  duplicateMicrolearnings?: boolean | null
  shouldDuplicateGroupActivities: boolean
  ctx: ContextWithUser
  prisma: PrismaTransactionClient
}): Promise<CourseDuplicationActivityIds> {
  const deltaCourseStart = getCourseStartDayDelta(
    startDate,
    oldCourse.startDate
  )

  return {
    liveQuizIds: duplicateLiveQuizzes
      ? await copyCourseLiveQuizzes({
          liveQuizzes: oldCourse.liveQuizzes,
          newCourseId,
          ctx,
          prisma,
        })
      : new Map(),
    practiceQuizIds: duplicatePracticeQuizzes
      ? await copyCoursePracticeQuizzes({
          practiceQuizzes: oldCourse.practiceQuizzes,
          newCourseId,
          ctx,
          prisma,
        })
      : new Map(),
    microLearningIds: duplicateMicrolearnings
      ? await copyCourseMicroLearnings({
          microLearnings: oldCourse.microLearnings,
          newCourseId,
          deltaCourseStart,
          ctx,
          prisma,
        })
      : new Map(),
    groupActivityIds: shouldDuplicateGroupActivities
      ? await copyCourseGroupActivities({
          groupActivities: oldCourse.groupActivities,
          newCourseId,
          deltaCourseStart,
          ctx,
          prisma,
        })
      : new Map(),
  }
}

async function copyMappedActivityPermissions<
  TSourceActivity extends { id: string; directPermissions: DB.Permission[] },
>({
  sourceActivities,
  copiedIdBySourceId,
  sourceObjectType,
  targetObjectType,
  targetFromId,
  ctx,
  prisma,
}: {
  sourceActivities: TSourceActivity[]
  copiedIdBySourceId: Map<string, string>
  sourceObjectType: DB.ObjectType
  targetObjectType: DB.ObjectType
  targetFromId: (id: string) => CourseDuplicationPermissionTarget
  ctx: ContextWithUser
  prisma: PrismaTransactionClient
}) {
  for (const sourceActivity of sourceActivities) {
    const copiedActivityId = copiedIdBySourceId.get(sourceActivity.id)
    if (!copiedActivityId) continue

    await copyCourseDuplicationDirectPermissions({
      sourcePermissions: sourceActivity.directPermissions,
      sourceObjectType,
      sourceObjectId: sourceActivity.id,
      targetObjectType,
      target: targetFromId(copiedActivityId),
      ctx,
      prisma,
    })
  }
}

async function copyDuplicatedActivityPermissions({
  oldCourse,
  copiedActivityIds,
  ctx,
  prisma,
}: {
  oldCourse: CourseDuplicationSourceCourse
  copiedActivityIds: CourseDuplicationActivityIds
  ctx: ContextWithUser
  prisma: PrismaTransactionClient
}) {
  await copyMappedActivityPermissions({
    sourceActivities: oldCourse.liveQuizzes,
    copiedIdBySourceId: copiedActivityIds.liveQuizIds,
    sourceObjectType: DB.ObjectType.LIVE_QUIZ,
    targetObjectType: DB.ObjectType.LIVE_QUIZ,
    targetFromId: (liveQuizId) => ({ liveQuizId }),
    ctx,
    prisma,
  })
  await copyMappedActivityPermissions({
    sourceActivities: oldCourse.practiceQuizzes,
    copiedIdBySourceId: copiedActivityIds.practiceQuizIds,
    sourceObjectType: DB.ObjectType.PRACTICE_QUIZ,
    targetObjectType: DB.ObjectType.PRACTICE_QUIZ,
    targetFromId: (practiceQuizId) => ({ practiceQuizId }),
    ctx,
    prisma,
  })
  await copyMappedActivityPermissions({
    sourceActivities: oldCourse.microLearnings,
    copiedIdBySourceId: copiedActivityIds.microLearningIds,
    sourceObjectType: DB.ObjectType.MICRO_LEARNING,
    targetObjectType: DB.ObjectType.MICRO_LEARNING,
    targetFromId: (microLearningId) => ({ microLearningId }),
    ctx,
    prisma,
  })
  await copyMappedActivityPermissions({
    sourceActivities: oldCourse.groupActivities,
    copiedIdBySourceId: copiedActivityIds.groupActivityIds,
    sourceObjectType: DB.ObjectType.GROUP_ACTIVITY,
    targetObjectType: DB.ObjectType.GROUP_ACTIVITY,
    targetFromId: (groupActivityId) => ({ groupActivityId }),
    ctx,
    prisma,
  })
}

type CourseDuplicationSelection = {
  duplicateLiveQuizzes?: boolean | null
  duplicatePracticeQuizzes?: boolean | null
  duplicateMicrolearnings?: boolean | null
  shouldDuplicateGroupActivities: boolean
}

function getCourseDuplicationActivityAccessChecks({
  oldCourse,
  selection,
}: {
  oldCourse: CourseDuplicationSourceCourse
  selection: CourseDuplicationSelection
}): PermissionCheck[] {
  const checks: PermissionCheck[] = []

  if (selection.duplicateLiveQuizzes) {
    checks.push(
      ...oldCourse.liveQuizzes.map((liveQuiz) => ({
        liveQuizId: liveQuiz.id,
        minimumPermissionLevel: DB.PermissionLevel.ADMIN,
      }))
    )
  }

  if (selection.duplicatePracticeQuizzes) {
    checks.push(
      ...oldCourse.practiceQuizzes.map((practiceQuiz) => ({
        practiceQuizId: practiceQuiz.id,
        minimumPermissionLevel: DB.PermissionLevel.ADMIN,
      }))
    )
  }

  if (selection.duplicateMicrolearnings) {
    checks.push(
      ...oldCourse.microLearnings.map((microLearning) => ({
        microLearningId: microLearning.id,
        minimumPermissionLevel: DB.PermissionLevel.ADMIN,
      }))
    )
  }

  if (selection.shouldDuplicateGroupActivities) {
    checks.push(
      ...oldCourse.groupActivities.map((groupActivity) => ({
        groupActivityId: groupActivity.id,
        minimumPermissionLevel: DB.PermissionLevel.ADMIN,
      }))
    )
  }

  return checks
}

function getCourseDuplicationInstanceIds({
  oldCourse,
  selection,
}: {
  oldCourse: CourseDuplicationSourceCourse
  selection: CourseDuplicationSelection
}) {
  const instanceIds: number[] = []

  if (selection.duplicateLiveQuizzes) {
    instanceIds.push(
      ...oldCourse.liveQuizzes.flatMap((liveQuiz) =>
        liveQuiz.blocks.flatMap((block) =>
          block.elements.map((element) => element.id)
        )
      )
    )
  }

  if (selection.duplicatePracticeQuizzes) {
    instanceIds.push(
      ...oldCourse.practiceQuizzes.flatMap((practiceQuiz) =>
        practiceQuiz.stacks.flatMap((stack) =>
          stack.elements.map((element) => element.id)
        )
      )
    )
  }

  if (selection.duplicateMicrolearnings) {
    instanceIds.push(
      ...oldCourse.microLearnings.flatMap((microLearning) =>
        microLearning.stacks.flatMap((stack) =>
          stack.elements.map((element) => element.id)
        )
      )
    )
  }

  if (selection.shouldDuplicateGroupActivities) {
    instanceIds.push(
      ...oldCourse.groupActivities.flatMap((groupActivity) =>
        groupActivity.stacks.flatMap((stack) =>
          stack.elements.map((element) => element.id)
        )
      )
    )
  }

  return [...new Set(instanceIds)]
}

async function assertCourseDuplicationActivityAccess({
  oldCourse,
  selection,
  ctx,
}: {
  oldCourse: CourseDuplicationSourceCourse
  selection: CourseDuplicationSelection
  ctx: ContextWithUser
}) {
  const checks = getCourseDuplicationActivityAccessChecks({
    oldCourse,
    selection,
  })

  if (checks.length > 0 && !(await checkAccess(checks, ctx))) {
    throw courseDuplicationPartialFailure(
      'Not all selected activities could be duplicated'
    )
  }

  if (
    selection.shouldDuplicateGroupActivities &&
    oldCourse.groupActivities.some((activity) => activity.stacks.length !== 1)
  ) {
    throw courseDuplicationPartialFailure(
      'Not all group activities could be duplicated'
    )
  }
}

async function assertCourseDuplicationInstanceAccess({
  oldCourse,
  selection,
  ctx,
}: {
  oldCourse: CourseDuplicationSourceCourse
  selection: CourseDuplicationSelection
  ctx: ContextWithUser
}) {
  const instanceIds = getCourseDuplicationInstanceIds({ oldCourse, selection })

  if (instanceIds.length === 0) return

  const accessibleInstanceCount = await ctx.prisma.elementInstance.count({
    where: {
      id: { in: instanceIds },
      element: {
        permissions: {
          some: {
            userId: ctx.user.sub,
            permissionLevel: {
              in: [DB.PermissionLevel.ADMIN, DB.PermissionLevel.OWNER],
            },
          },
        },
      },
    },
  })

  if (accessibleInstanceCount !== instanceIds.length) {
    throw courseDuplicationPartialFailure(
      'Not all activity instances could be duplicated'
    )
  }
}

export async function duplicateCourse(
  {
    courseId,
    name,
    displayName,
    description,
    color,
    startDate,
    endDate,
    isGroupCreationEnabled,
    groupDeadlineDate,
    maxGroupSize,
    preferredGroupSize,
    language,
    notificationEmail,
    sourceCourseId,
    duplicateLiveQuizzes,
    duplicatePracticeQuizzes,
    duplicateMicrolearnings,
    duplicateGroupActivities,
  }: CourseDuplicationArgs,
  ctx: ContextWithUser
) {
  if (!sourceCourseId) {
    throw new Error('Course ID to duplicate not provided')
  }

  const hasDuplicationAccess = await checkAccess(
    [
      {
        courseId: sourceCourseId,
        minimumPermissionLevel: DB.PermissionLevel.ADMIN,
      },
    ],
    ctx
  )
  if (!hasDuplicationAccess) return null

  await recomputeDerivedPermissions(
    { courseId: sourceCourseId, userId: ctx.user.sub },
    ctx.prisma
  )
  const hasRefreshedDuplicationAccess = await checkAccess(
    [
      {
        courseId: sourceCourseId,
        minimumPermissionLevel: DB.PermissionLevel.ADMIN,
      },
    ],
    ctx
  )
  if (!hasRefreshedDuplicationAccess) return null

  const oldCourse = await ctx.prisma.course.findUnique({
    where: { id: sourceCourseId, isDeleted: false },
    include: courseDuplicationInclude,
  })

  if (!oldCourse) return null

  const shouldDuplicateGroupActivities = Boolean(
    duplicateGroupActivities && isGroupCreationEnabled
  )
  const selection = {
    duplicateLiveQuizzes,
    duplicatePracticeQuizzes,
    duplicateMicrolearnings,
    shouldDuplicateGroupActivities,
  }

  await assertCourseDuplicationActivityAccess({ oldCourse, selection, ctx })
  await assertCourseDuplicationInstanceAccess({ oldCourse, selection, ctx })

  return await ctx.prisma.$transaction(
    async (prisma) => {
      // A deletion and duplication of the same source course must not copy a
      // partially deleted graph. Re-check the source after taking the same
      // transaction-scoped fence used by course deletion.
      const advisoryLockKey = getCourseDeletionAdvisoryLockKey(sourceCourseId)
      await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${advisoryLockKey}, 0))`

      const activeSourceCourse = await prisma.course.findUnique({
        where: { id: sourceCourseId, isDeleted: false },
        select: { id: true },
      })
      if (!activeSourceCourse) return null

      const newCourse = await createCourse(
        {
          courseId,
          name,
          displayName,
          description,
          color,
          startDate,
          endDate,
          isGroupCreationEnabled,
          groupDeadlineDate,
          maxGroupSize,
          preferredGroupSize,
          language,
          notificationEmail,
          isGamificationEnabled: oldCourse.isGamificationEnabled,
          isAssessmentEnabled: oldCourse.isAssessmentEnabled,
        },
        ctx,
        prisma
      )

      const copiedActivityIds = await duplicateSelectedCourseActivities({
        oldCourse,
        newCourseId: newCourse.id,
        startDate,
        duplicateLiveQuizzes,
        duplicatePracticeQuizzes,
        duplicateMicrolearnings,
        shouldDuplicateGroupActivities,
        ctx,
        prisma,
      })

      await prisma.course.update({
        where: { id: newCourse.id },
        data: {
          competencyTreeId: oldCourse.competencyTreeId,
          authType: oldCourse.authType,
          pinCode:
            oldCourse.authType === DB.CourseAuthType.SSO ? null : undefined,
        },
      })

      await copyCourseDuplicationDirectPermissions({
        sourcePermissions: oldCourse.directPermissions,
        sourceObjectType: DB.ObjectType.COURSE,
        sourceObjectId: oldCourse.id,
        targetObjectType: DB.ObjectType.COURSE,
        target: {
          courseId: newCourse.id,
        },
        ctx,
        prisma,
      })

      await grantDuplicatedCourseAccessToSourceOwner({
        sourceCourseId: oldCourse.id,
        sourceOwnerId: oldCourse.ownerId,
        targetCourseId: newCourse.id,
        ctx,
        prisma,
      })

      await copyDuplicatedActivityPermissions({
        oldCourse,
        copiedActivityIds,
        ctx,
        prisma,
      })

      await recomputeDerivedPermissions({ courseId: newCourse.id }, prisma)

      const refreshedCourse = await prisma.course.findUnique({
        where: { id: newCourse.id },
        include: {
          _count: {
            select: { permissions: true },
          },
        },
      })

      if (!refreshedCourse) return newCourse

      const { _count, ...course } = refreshedCourse

      return {
        ...course,
        derivedAccess: false,
        numSharedUsers: Math.max(_count.permissions - 1, 0),
        permissionLevel: DB.PermissionLevel.OWNER,
        isOwner: true,
        isManager: true,
        isEditor: true,
        isShared: false,
        isRemovable: false,
      }
    },
    { timeout: DUPLICATE_COURSE_TRANSACTION_TIMEOUT }
  )
}
