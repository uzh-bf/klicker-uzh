import { randomUUID } from 'node:crypto'
import { GraphQLError } from 'graphql'
import type { Redis } from 'ioredis'
import type { ContextWithUser } from '../lib/context.js'
import type { ObjectSelectorFunction } from './sharing.js'

const COURSE_DELETION_STATUS_KEY_PREFIX = 'course-deletion:job'
const COURSE_DELETION_COURSE_LOCK_KEY_PREFIX = 'course-deletion:course'
const COURSE_MUTATION_FENCE_KEY_PREFIX = 'course-deletion:mutations'
const COURSE_MUTATION_FENCE_TTL_SECONDS = 10 * 60
const COURSE_MUTATION_FENCE_RENEWAL_MS = 60 * 1000

type CourseDeletionObjectSelector = ReturnType<ObjectSelectorFunction>

interface CourseMutationFenceState {
  cleanupRegistered: boolean
  leases: Map<string, string>
  renewalTimer?: ReturnType<typeof setInterval>
}

const courseMutationFencesByContext = new WeakMap<
  ContextWithUser,
  CourseMutationFenceState
>()

export function getCourseDeletionStatusKey(jobId: string) {
  return `${COURSE_DELETION_STATUS_KEY_PREFIX}:${jobId}`
}

export function getCourseDeletionCourseLockKey(courseId: string) {
  return `${COURSE_DELETION_COURSE_LOCK_KEY_PREFIX}:${courseId}`
}

export function getCourseMutationFenceKey(courseId: string) {
  return `${COURSE_MUTATION_FENCE_KEY_PREFIX}:${courseId}`
}

export function isTerminalCourseDeletionStatus(status: unknown) {
  return status === 'COMPLETED' || status === 'FAILED'
}

async function getCourseIdForDeletionGuard(
  selector: CourseDeletionObjectSelector,
  ctx: ContextWithUser
) {
  if ('courseId' in selector) return selector.courseId

  if ('liveQuizId' in selector) {
    const activity = await ctx.prisma.liveQuiz.findUnique({
      where: { id: selector.liveQuizId },
      select: { courseId: true },
    })
    return activity?.courseId
  }

  if ('practiceQuizId' in selector) {
    const activity = await ctx.prisma.practiceQuiz.findUnique({
      where: { id: selector.practiceQuizId },
      select: { courseId: true },
    })
    return activity?.courseId
  }

  if ('microLearningId' in selector) {
    const activity = await ctx.prisma.microLearning.findUnique({
      where: { id: selector.microLearningId },
      select: { courseId: true },
    })
    return activity?.courseId
  }

  if ('groupActivityId' in selector) {
    const activity = await ctx.prisma.groupActivity.findUnique({
      where: { id: selector.groupActivityId },
      select: { courseId: true },
    })
    return activity?.courseId
  }

  return undefined
}

function lockReferencesTerminalJob(rawJob: string | null) {
  if (!rawJob) return false

  try {
    const job = JSON.parse(rawJob) as { status?: unknown }
    return isTerminalCourseDeletionStatus(job.status)
  } catch (error) {
    console.error('Failed to parse course deletion job status:', error)
    return false
  }
}

async function releaseTerminalCourseDeletionLock(
  redis: Redis,
  courseId: string,
  jobId: string
) {
  await redis.eval(
    `if redis.call("get", KEYS[1]) == ARGV[1] then
      return redis.call("del", KEYS[1])
    end
    return 0`,
    1,
    getCourseDeletionCourseLockKey(courseId),
    jobId
  )
}

async function acquireCourseMutationFence(
  redis: Redis,
  courseId: string,
  token: string
) {
  const now = Date.now()
  const expiresAt = now + COURSE_MUTATION_FENCE_TTL_SECONDS * 1000
  return await redis.eval(
    `redis.call("zremrangebyscore", KEYS[2], "-inf", ARGV[2])
    if redis.call("exists", KEYS[1]) == 1 then
      return 0
    end
    redis.call("zadd", KEYS[2], ARGV[3], ARGV[1])
    redis.call("expire", KEYS[2], ARGV[4])
    return 1`,
    2,
    getCourseDeletionCourseLockKey(courseId),
    getCourseMutationFenceKey(courseId),
    token,
    now,
    expiresAt,
    COURSE_MUTATION_FENCE_TTL_SECONDS
  )
}

async function renewCourseMutationFence(
  redis: Redis,
  courseId: string,
  token: string
) {
  const expiresAt = Date.now() + COURSE_MUTATION_FENCE_TTL_SECONDS * 1000
  await redis.eval(
    `if redis.call("zscore", KEYS[1], ARGV[1]) then
      redis.call("zadd", KEYS[1], ARGV[2], ARGV[1])
      redis.call("expire", KEYS[1], ARGV[3])
      return 1
    end
    return 0`,
    1,
    getCourseMutationFenceKey(courseId),
    token,
    expiresAt,
    COURSE_MUTATION_FENCE_TTL_SECONDS
  )
}

async function releaseCourseMutationFence(
  redis: Redis,
  courseId: string,
  token: string
) {
  await redis.eval(
    `redis.call("zrem", KEYS[1], ARGV[1])
    if redis.call("zcard", KEYS[1]) == 0 then
      redis.call("del", KEYS[1])
    end
    return 1`,
    1,
    getCourseMutationFenceKey(courseId),
    token
  )
}

function registerCourseMutationFenceCleanup(
  ctx: ContextWithUser,
  state: CourseMutationFenceState
) {
  if (state.cleanupRegistered || typeof ctx.res?.once !== 'function') return
  state.cleanupRegistered = true

  let cleaned = false
  const cleanup = () => {
    if (cleaned) return
    cleaned = true
    if (state.renewalTimer) clearInterval(state.renewalTimer)
    courseMutationFencesByContext.delete(ctx)
    for (const [courseId, token] of state.leases) {
      void releaseCourseMutationFence(ctx.redisExec, courseId, token).catch(
        (error) =>
          console.error('Failed to release course mutation fence:', error)
      )
    }
  }

  state.renewalTimer = setInterval(() => {
    for (const [courseId, token] of state.leases) {
      void renewCourseMutationFence(ctx.redisExec, courseId, token).catch(
        (error) =>
          console.error('Failed to renew course mutation fence:', error)
      )
    }
  }, COURSE_MUTATION_FENCE_RENEWAL_MS)
  state.renewalTimer.unref()
  ctx.res.once('finish', cleanup)
  ctx.res.once('close', cleanup)
}

async function ensureCourseMutationFence(
  courseId: string,
  ctx: ContextWithUser
) {
  let state = courseMutationFencesByContext.get(ctx)
  if (!state) {
    state = { cleanupRegistered: false, leases: new Map() }
    courseMutationFencesByContext.set(ctx, state)
  }
  if (state.leases.has(courseId)) return

  const token = randomUUID()
  const acquired = await acquireCourseMutationFence(
    ctx.redisExec,
    courseId,
    token
  )
  if (Number(acquired) !== 1) {
    throw new GraphQLError('Course deletion is already in progress', {
      extensions: { code: 'COURSE_DELETION_IN_PROGRESS' },
    })
  }

  state.leases.set(courseId, token)
  registerCourseMutationFenceCleanup(ctx, state)
}

export async function acquireCourseDeletionLock(
  redis: Redis,
  courseId: string,
  jobId: string,
  ttlSeconds: number
) {
  const acquired = await redis.eval(
    `redis.call("zremrangebyscore", KEYS[2], "-inf", ARGV[2])
    if redis.call("exists", KEYS[1]) == 1 or redis.call("zcard", KEYS[2]) > 0 then
      return 0
    end
    redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[3])
    return 1`,
    2,
    getCourseDeletionCourseLockKey(courseId),
    getCourseMutationFenceKey(courseId),
    jobId,
    Date.now(),
    ttlSeconds
  )

  return Number(acquired) === 1
}

export async function assertCourseDeletionNotInProgress(
  selector: CourseDeletionObjectSelector,
  ctx: ContextWithUser
) {
  const courseId = await getCourseIdForDeletionGuard(selector, ctx)
  if (!courseId) return

  const activeJobId = await ctx.redisExec.get(
    getCourseDeletionCourseLockKey(courseId)
  )
  if (activeJobId) {
    const rawJob = await ctx.redisExec.get(
      getCourseDeletionStatusKey(activeJobId)
    )
    if (!lockReferencesTerminalJob(rawJob)) {
      throw new GraphQLError('Course deletion is already in progress', {
        extensions: { code: 'COURSE_DELETION_IN_PROGRESS' },
      })
    }
    await releaseTerminalCourseDeletionLock(
      ctx.redisExec,
      courseId,
      activeJobId
    )
  }

  await ensureCourseMutationFence(courseId, ctx)
}
