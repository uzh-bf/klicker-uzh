import { randomUUID } from 'node:crypto'
import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { Redis } from 'ioredis'
import type { Context, ContextWithUser } from '../lib/context.js'
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
  Context,
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

export function getCourseDeletionAdvisoryLockKey(courseId: string) {
  return `course-deletion:${courseId}`
}

export function isTerminalCourseDeletionStatus(status: unknown) {
  return status === 'COMPLETED' || status === 'FAILED'
}

async function getCourseTargetForDeletionGuard(
  selector: CourseDeletionObjectSelector,
  ctx: Context
) {
  if ('courseId' in selector) {
    const course = await ctx.prisma.course.findUnique({
      where: { id: selector.courseId },
      select: { id: true, isDeleted: true },
    })
    return course
      ? { courseId: course.id, isDeleted: course.isDeleted }
      : undefined
  }

  if ('liveQuizId' in selector) {
    const activity = await ctx.prisma.liveQuiz.findUnique({
      where: { id: selector.liveQuizId },
      select: { courseId: true, course: { select: { isDeleted: true } } },
    })
    return activity?.courseId
      ? {
          courseId: activity.courseId,
          isDeleted: activity.course?.isDeleted ?? false,
        }
      : undefined
  }

  if ('practiceQuizId' in selector) {
    const activity = await ctx.prisma.practiceQuiz.findUnique({
      where: { id: selector.practiceQuizId },
      select: { courseId: true, course: { select: { isDeleted: true } } },
    })
    return activity
      ? { courseId: activity.courseId, isDeleted: activity.course.isDeleted }
      : undefined
  }

  if ('microLearningId' in selector) {
    const activity = await ctx.prisma.microLearning.findUnique({
      where: { id: selector.microLearningId },
      select: { courseId: true, course: { select: { isDeleted: true } } },
    })
    return activity
      ? { courseId: activity.courseId, isDeleted: activity.course.isDeleted }
      : undefined
  }

  if ('groupActivityId' in selector) {
    const activity = await ctx.prisma.groupActivity.findUnique({
      where: { id: selector.groupActivityId },
      select: { courseId: true, course: { select: { isDeleted: true } } },
    })
    return activity
      ? { courseId: activity.courseId, isDeleted: activity.course.isDeleted }
      : undefined
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
  ctx: Context,
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

async function ensureCourseMutationFence(courseId: string, ctx: Context) {
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
  ctx: Context
) {
  const target = await getCourseTargetForDeletionGuard(selector, ctx)
  if (!target) return
  if (target.isDeleted) {
    throw new GraphQLError('Course is no longer available', {
      extensions: { code: 'COURSE_DELETED' },
    })
  }
  const { courseId } = target

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

export async function assertCourseMutationAllowed(
  courseId: string | null | undefined,
  ctx: Context
) {
  if (!courseId) return
  await assertCourseDeletionNotInProgress({ courseId }, ctx)
}

export async function assertCoursePinMutationAllowed(
  pin: number,
  ctx: Context
) {
  const course = await ctx.prisma.course.findUnique({
    where: { pinCode: pin, isDeleted: false },
    select: { id: true },
  })
  await assertCourseMutationAllowed(course?.id, ctx)
}

export async function assertParticipantGroupMutationAllowed(
  groupId: string,
  ctx: Context
) {
  const group = await ctx.prisma.participantGroup.findUnique({
    where: { id: groupId },
    select: { courseId: true },
  })
  await assertCourseMutationAllowed(group?.courseId, ctx)
}

export async function assertGroupActivityInstanceMutationAllowed(
  instanceId: number,
  ctx: Context
) {
  const instance = await ctx.prisma.groupActivityInstance.findUnique({
    where: { id: instanceId },
    select: { groupActivity: { select: { courseId: true } } },
  })
  await assertCourseMutationAllowed(instance?.groupActivity.courseId, ctx)
}

export async function assertElementInstanceMutationAllowed(
  instanceId: number,
  ctx: Context
) {
  const instance = await ctx.prisma.elementInstance.findUnique({
    where: { id: instanceId },
    select: {
      elementStack: { select: { courseId: true } },
      elementBlock: {
        select: { liveQuiz: { select: { courseId: true } } },
      },
    },
  })
  await assertCourseMutationAllowed(
    instance?.elementStack?.courseId ??
      instance?.elementBlock?.liveQuiz.courseId,
    ctx
  )
}

export async function assertChatbotMutationAllowed(
  chatbotId: string,
  ctx: Context
) {
  const chatbot = await ctx.prisma.chatbot.findUnique({
    where: { id: chatbotId },
    select: { courseId: true },
  })
  await assertCourseMutationAllowed(chatbot?.courseId, ctx)
}

function getObjectSelector(
  objectType: DB.ObjectType,
  objectId: string
): CourseDeletionObjectSelector | null {
  switch (objectType) {
    case DB.ObjectType.COURSE:
      return { courseId: objectId }
    case DB.ObjectType.LIVE_QUIZ:
      return { liveQuizId: objectId }
    case DB.ObjectType.PRACTICE_QUIZ:
      return { practiceQuizId: objectId }
    case DB.ObjectType.MICRO_LEARNING:
      return { microLearningId: objectId }
    case DB.ObjectType.GROUP_ACTIVITY:
      return { groupActivityId: objectId }
    default:
      return null
  }
}

export async function assertObjectMutationAllowed(
  objectType: DB.ObjectType,
  objectId: string,
  ctx: Context
) {
  const selector = getObjectSelector(objectType, objectId)
  if (selector) await assertCourseDeletionNotInProgress(selector, ctx)
}

export async function assertFeedbackMutationAllowed(
  feedbackId: number,
  ctx: Context
) {
  const feedback = await ctx.prisma.feedback.findUnique({
    where: { id: feedbackId },
    select: { liveQuizId: true },
  })
  if (feedback?.liveQuizId) {
    await assertCourseDeletionNotInProgress(
      { liveQuizId: feedback.liveQuizId },
      ctx
    )
  }
}

export async function assertFeedbackResponseMutationAllowed(
  feedbackResponseId: number,
  ctx: Context
) {
  const response = await ctx.prisma.feedbackResponse.findUnique({
    where: { id: feedbackResponseId },
    select: { feedback: { select: { liveQuizId: true } } },
  })
  if (response?.feedback.liveQuizId) {
    await assertCourseDeletionNotInProgress(
      { liveQuizId: response.feedback.liveQuizId },
      ctx
    )
  }
}

export async function assertSharingRequestMutationAllowed(
  requestId: number,
  userId: string,
  ctx: ContextWithUser
) {
  const request = await ctx.prisma.accessRequest.findUnique({
    where: {
      id: requestId,
      userId,
      objectAdminOrOwnerId: ctx.user.sub,
    },
    select: {
      courseId: true,
      liveQuizId: true,
      practiceQuizId: true,
      microLearningId: true,
      groupActivityId: true,
    },
  })
  if (!request) return

  const selector = request.courseId
    ? getObjectSelector(DB.ObjectType.COURSE, request.courseId)
    : request.liveQuizId
      ? getObjectSelector(DB.ObjectType.LIVE_QUIZ, request.liveQuizId)
      : request.practiceQuizId
        ? getObjectSelector(DB.ObjectType.PRACTICE_QUIZ, request.practiceQuizId)
        : request.microLearningId
          ? getObjectSelector(
              DB.ObjectType.MICRO_LEARNING,
              request.microLearningId
            )
          : request.groupActivityId
            ? getObjectSelector(
                DB.ObjectType.GROUP_ACTIVITY,
                request.groupActivityId
              )
            : null

  if (selector) await assertCourseDeletionNotInProgress(selector, ctx)
}
