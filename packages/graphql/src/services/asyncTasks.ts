import * as DB from '@klicker-uzh/prisma/client'
import { COURSE_DUPLICATION_ERROR_CODES } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import {
  COURSE_DUPLICATION_STALE_AFTER_MS,
  getCourseDuplicationStatusKey,
} from './courseDuplicationShared.js'

const ASYNC_TASK_ACTIVE_LIMIT = 50
const ASYNC_TASK_RECENT_LIMIT = 20
const ASYNC_TASK_ACKNOWLEDGEMENT_LIMIT = 50
const ASYNC_TASK_RECENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

const ACTIVE_ASYNC_TASK_STATUSES = [
  DB.AsyncTaskStatus.QUEUED,
  DB.AsyncTaskStatus.RUNNING,
] as const

const TERMINAL_ASYNC_TASK_STATUSES = [
  DB.AsyncTaskStatus.SUCCEEDED,
  DB.AsyncTaskStatus.FAILED,
] as const

export interface CourseDuplicationTaskSnapshot {
  id: string
  status: 'COMPLETED' | 'FAILED' | 'PENDING' | 'RUNNING'
  sourceCourseId: string
  sourceCourseName: string
  targetCourseName: string
  createdCourseId?: string | null
  errorType?: 'access' | 'generic' | 'partial' | null
  createdAt: Date
  updatedAt: Date
  userId: string
}

function mapCourseDuplicationStatus(
  status: CourseDuplicationTaskSnapshot['status']
) {
  switch (status) {
    case 'PENDING':
      return DB.AsyncTaskStatus.QUEUED
    case 'RUNNING':
      return DB.AsyncTaskStatus.RUNNING
    case 'COMPLETED':
      return DB.AsyncTaskStatus.SUCCEEDED
    case 'FAILED':
      return DB.AsyncTaskStatus.FAILED
  }
}

function getCourseDuplicationErrorCode(
  errorType: CourseDuplicationTaskSnapshot['errorType']
) {
  switch (errorType) {
    case 'access':
      return COURSE_DUPLICATION_ERROR_CODES.accessDenied
    case 'partial':
      return COURSE_DUPLICATION_ERROR_CODES.partialFailure
    case 'generic':
      return COURSE_DUPLICATION_ERROR_CODES.failed
    default:
      return null
  }
}

function getAllowedPreviousStatuses(status: DB.AsyncTaskStatus) {
  switch (status) {
    case DB.AsyncTaskStatus.RUNNING:
      return [DB.AsyncTaskStatus.QUEUED]
    case DB.AsyncTaskStatus.SUCCEEDED:
    case DB.AsyncTaskStatus.FAILED:
      return [DB.AsyncTaskStatus.QUEUED, DB.AsyncTaskStatus.RUNNING]
    case DB.AsyncTaskStatus.QUEUED:
      return []
  }
}

function getCourseDuplicationTaskData(job: CourseDuplicationTaskSnapshot) {
  const status = mapCourseDuplicationStatus(job.status)
  const terminal =
    status === DB.AsyncTaskStatus.SUCCEEDED ||
    status === DB.AsyncTaskStatus.FAILED

  return {
    kind: DB.AsyncTaskKind.COURSE_DUPLICATION,
    status,
    subjectId: job.sourceCourseId,
    subjectName: job.sourceCourseName,
    targetName: job.targetCourseName,
    resultId: job.createdCourseId ?? null,
    errorCode:
      status === DB.AsyncTaskStatus.FAILED
        ? getCourseDuplicationErrorCode(job.errorType)
        : null,
    startedAt:
      status === DB.AsyncTaskStatus.RUNNING ? job.updatedAt : undefined,
    finishedAt: terminal ? job.updatedAt : null,
  }
}

async function reconcileMissingCourseDuplicationTasks(ctx: ContextWithUser) {
  const where = {
    kind: DB.AsyncTaskKind.COURSE_DUPLICATION,
    ownerId: ctx.user.sub,
    status: { in: [...ACTIVE_ASYNC_TASK_STATUSES] },
  }
  const [newestActiveTasks, oldestActiveTasks] = await Promise.all([
    ctx.prisma.asyncTask.findMany({
      where,
      select: { id: true, updatedAt: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: ASYNC_TASK_ACTIVE_LIMIT,
    }),
    ctx.prisma.asyncTask.findMany({
      where,
      select: { id: true, updatedAt: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: ASYNC_TASK_ACTIVE_LIMIT,
    }),
  ])
  const activeTasks = [
    ...new Map(
      [...newestActiveTasks, ...oldestActiveTasks].map((task) => [
        task.id,
        task,
      ])
    ).values(),
  ]
  if (activeTasks.length === 0) return

  const redisJobs = await ctx.redisExec.mget(
    ...activeTasks.map((task) => getCourseDuplicationStatusKey(task.id))
  )
  const missingTasks = activeTasks.filter((_, index) => !redisJobs[index])
  if (missingTasks.length === 0) return

  const committedCourses = await ctx.prisma.course.findMany({
    where: { id: { in: missingTasks.map((task) => task.id) } },
    select: { id: true },
  })
  const committedCourseIds = new Set(
    committedCourses.map((course) => course.id)
  )
  const now = new Date()
  const staleCutoff = now.getTime() - COURSE_DUPLICATION_STALE_AFTER_MS

  await Promise.all(
    missingTasks.map(async (task) => {
      const committed = committedCourseIds.has(task.id)
      if (!committed && task.updatedAt.getTime() >= staleCutoff) return

      await ctx.prisma.asyncTask.updateMany({
        where: {
          id: task.id,
          ownerId: ctx.user.sub,
          status: { in: [...ACTIVE_ASYNC_TASK_STATUSES] },
        },
        data: committed
          ? {
              status: DB.AsyncTaskStatus.SUCCEEDED,
              resultId: task.id,
              errorCode: null,
              finishedAt: now,
            }
          : {
              status: DB.AsyncTaskStatus.FAILED,
              resultId: null,
              errorCode: COURSE_DUPLICATION_ERROR_CODES.failed,
              finishedAt: now,
            },
      })
    })
  )
}

export async function getAsyncTasks(ctx: ContextWithUser) {
  try {
    await reconcileMissingCourseDuplicationTasks(ctx)
  } catch (error) {
    console.error('Failed to reconcile course duplication tasks', error)
  }

  const recentCutoff = new Date(Date.now() - ASYNC_TASK_RECENT_RETENTION_MS)
  const [activeTasks, unreadRecentTasks, readRecentTasks] = await Promise.all([
    ctx.prisma.asyncTask.findMany({
      where: {
        ownerId: ctx.user.sub,
        status: { in: [...ACTIVE_ASYNC_TASK_STATUSES] },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: ASYNC_TASK_ACTIVE_LIMIT,
    }),
    ctx.prisma.asyncTask.findMany({
      where: {
        ownerId: ctx.user.sub,
        readAt: null,
        status: { in: [...TERMINAL_ASYNC_TASK_STATUSES] },
        finishedAt: { gte: recentCutoff },
      },
      orderBy: [{ finishedAt: 'desc' }, { id: 'desc' }],
      take: ASYNC_TASK_RECENT_LIMIT,
    }),
    ctx.prisma.asyncTask.findMany({
      where: {
        ownerId: ctx.user.sub,
        readAt: { not: null },
        status: { in: [...TERMINAL_ASYNC_TASK_STATUSES] },
        finishedAt: { gte: recentCutoff },
      },
      orderBy: [{ finishedAt: 'desc' }, { id: 'desc' }],
      take: ASYNC_TASK_RECENT_LIMIT,
    }),
  ])

  const recentTasks = [
    ...unreadRecentTasks,
    ...readRecentTasks.slice(
      0,
      ASYNC_TASK_RECENT_LIMIT - unreadRecentTasks.length
    ),
  ].sort(
    (left, right) =>
      (right.finishedAt?.getTime() ?? 0) - (left.finishedAt?.getTime() ?? 0)
  )

  return [...activeTasks, ...recentTasks]
}

export async function getAsyncTaskAttentionCount(ctx: ContextWithUser) {
  const recentCutoff = new Date(Date.now() - ASYNC_TASK_RECENT_RETENTION_MS)

  return await ctx.prisma.asyncTask.count({
    where: {
      ownerId: ctx.user.sub,
      OR: [
        { status: { in: [...ACTIVE_ASYNC_TASK_STATUSES] } },
        {
          readAt: null,
          status: { in: [...TERMINAL_ASYNC_TASK_STATUSES] },
          finishedAt: { gte: recentCutoff },
        },
      ],
    },
  })
}

export async function acknowledgeAsyncTasks(
  { ids }: { ids: string[] },
  ctx: ContextWithUser
) {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length > ASYNC_TASK_ACKNOWLEDGEMENT_LIMIT) {
    throw new GraphQLError(
      `At most ${ASYNC_TASK_ACKNOWLEDGEMENT_LIMIT} tasks can be acknowledged at once.`,
      { extensions: { code: 'BAD_USER_INPUT' } }
    )
  }

  if (uniqueIds.length === 0) return 0

  const result = await ctx.prisma.asyncTask.updateMany({
    where: {
      id: { in: uniqueIds },
      ownerId: ctx.user.sub,
      readAt: null,
      status: { in: [...TERMINAL_ASYNC_TASK_STATUSES] },
    },
    data: { readAt: new Date() },
  })

  return result.count
}

export async function syncCourseDuplicationTask(
  job: CourseDuplicationTaskSnapshot,
  prisma: DB.PrismaClient
) {
  const data = getCourseDuplicationTaskData(job)
  const allowedPreviousStatuses = getAllowedPreviousStatuses(data.status)

  if (allowedPreviousStatuses.length > 0) {
    const transition = await prisma.asyncTask.updateMany({
      where: {
        id: job.id,
        kind: DB.AsyncTaskKind.COURSE_DUPLICATION,
        ownerId: job.userId,
        status: { in: allowedPreviousStatuses },
      },
      data,
    })
    if (transition.count > 0) {
      return await prisma.asyncTask.findUnique({ where: { id: job.id } })
    }
  }

  const existingTask = await prisma.asyncTask.findUnique({
    where: { id: job.id },
  })
  if (existingTask) {
    if (
      existingTask.kind !== DB.AsyncTaskKind.COURSE_DUPLICATION ||
      existingTask.ownerId !== job.userId
    ) {
      throw new Error(`Async task ${job.id} belongs to another producer`)
    }

    return existingTask
  }

  try {
    return await prisma.asyncTask.create({
      data: {
        id: job.id,
        ownerId: job.userId,
        createdAt: job.createdAt,
        ...data,
      },
    })
  } catch (error) {
    const concurrentlyCreatedTask = await prisma.asyncTask.findUnique({
      where: { id: job.id },
    })
    if (
      concurrentlyCreatedTask?.kind === DB.AsyncTaskKind.COURSE_DUPLICATION &&
      concurrentlyCreatedTask.ownerId === job.userId
    ) {
      return await syncCourseDuplicationTask(job, prisma)
    }

    throw error
  }
}
