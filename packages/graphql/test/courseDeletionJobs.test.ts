import {
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import type { Redis } from 'ioredis'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'

const serviceMocks = vi.hoisted(() => ({
  checkAccess: vi.fn(),
  deleteCourse: vi.fn(),
}))

vi.mock('../src/services/sharing.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../src/services/sharing.js')>()
  return { ...original, checkAccess: serviceMocks.checkAccess }
})

vi.mock('../src/services/courses.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../src/services/courses.js')>()
  return { ...original, deleteCourse: serviceMocks.deleteCourse }
})

import {
  getCourseDeletionStatuses,
  handleProcessCourseDeletion,
  handleSweepStaleCourseDeletions,
  startCourseDeletion,
} from '../src/services/courseDeletion.js'

class FakeRedis {
  readonly values = new Map<string, string>()

  async get(key: string) {
    return this.values.get(key) ?? null
  }

  async set(key: string, value: string, ...args: Array<string | number>) {
    if (args.includes('NX') && this.values.has(key)) return null
    this.values.set(key, value)
    return 'OK'
  }

  async del(key: string) {
    return this.values.delete(key) ? 1 : 0
  }

  async eval(
    script: string,
    _numKeys: number,
    ...args: Array<string | number>
  ) {
    if (script.includes('redis.call("exists"')) {
      const [
        statusKey = '',
        processLockKey = '',
        heartbeatKey = '',
        expectedJob = '',
        updatedJob = '',
      ] = args.map(String)
      if (
        this.values.get(statusKey) !== expectedJob ||
        this.values.has(processLockKey) ||
        this.values.has(heartbeatKey)
      ) {
        return 0
      }
      this.values.set(statusKey, updatedJob)
      return 1
    }

    if (script.includes('redis.call("set"')) {
      const [
        lockKey = '',
        statusKey = '',
        expectedValue = '',
        serializedJob = '',
      ] = args.map(String)
      if (this.values.get(lockKey) !== expectedValue) return 0
      this.values.set(statusKey, serializedJob)
      return 1
    }

    const [key = '', expectedValue = ''] = args.map(String)
    if (this.values.get(key) !== expectedValue) return 0
    if (script.includes('expire')) return 1
    this.values.delete(key)
    return 1
  }

  async scan() {
    return ['0', []] as [string, string[]]
  }
}

function createContext(userId = 'user-1') {
  const redis = new FakeRedis()
  const findUnique = vi.fn().mockResolvedValue({
    id: 'course-id',
    name: 'Large course',
    isAssessmentEnabled: false,
    liveQuizzes: [],
    practiceQuizzes: [],
    microLearnings: [],
    groupActivities: [],
  })
  const push = vi.fn().mockResolvedValue(undefined)
  const deleteScheduledTask = vi.fn().mockResolvedValue(undefined)
  const ctx = {
    user: {
      sub: userId,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    prisma: { course: { findUnique } },
    redisExec: redis as unknown as Redis,
    redisAssessmentExec: {} as Redis,
    pubSub: {},
    emitter: { emit: vi.fn() },
    hatchet: {
      events: { push },
      scheduled: { delete: deleteScheduledTask },
    },
    tasks: {},
    req: undefined as never,
    res: undefined as never,
  } as unknown as ContextWithUser

  return { ctx, deleteScheduledTask, findUnique, push, redis }
}

function createExecutionContext() {
  return {
    logger: {
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
    },
  }
}

function createGlobalContext(ctx: ContextWithUser) {
  return {
    prisma: ctx.prisma,
    redisExec: ctx.redisExec,
    redisAssessmentExec: ctx.redisAssessmentExec,
    pubSub: ctx.pubSub,
    emitter: ctx.emitter,
    hatchet: ctx.hatchet,
    tasks: ctx.tasks,
  }
}

describe('course deletion jobs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.checkAccess.mockResolvedValue(true)
    serviceMocks.deleteCourse.mockResolvedValue({ id: 'course-id' })
  })

  it('starts one owner-scoped job and republishes a repeated pending start', async () => {
    const { ctx, push, redis } = createContext()

    const firstJob = await startCourseDeletion(
      { id: 'course-id', deleteDraftActivities: true },
      ctx
    )
    const repeatedJob = await startCourseDeletion(
      { id: 'course-id', deleteDraftActivities: true },
      ctx
    )

    expect(firstJob).toMatchObject({
      status: 'PENDING',
      courseId: 'course-id',
      courseName: 'Large course',
    })
    expect(repeatedJob?.id).toBe(firstJob?.id)
    expect(push).toHaveBeenCalledTimes(2)
    expect(push).toHaveBeenCalledWith('process-course-deletion', {
      jobId: firstJob?.id,
    })

    await expect(
      getCourseDeletionStatuses({ ids: [firstJob!.id] }, ctx)
    ).resolves.toEqual([firstJob])

    const otherUserCtx = {
      ...ctx,
      user: { ...ctx.user, sub: 'user-2' },
      redisExec: redis as unknown as Redis,
    }
    await expect(
      getCourseDeletionStatuses({ ids: [firstJob!.id] }, otherUserCtx)
    ).resolves.toEqual([])
  })

  it('does not expose another user active job through a repeated start', async () => {
    const { ctx } = createContext()
    await startCourseDeletion({ id: 'course-id' }, ctx)

    const otherUserCtx = {
      ...ctx,
      user: { ...ctx.user, sub: 'user-2' },
    }

    await expect(
      startCourseDeletion({ id: 'course-id' }, otherUserCtx)
    ).rejects.toMatchObject({
      extensions: { code: 'COURSE_DELETION_IN_PROGRESS' },
    })
  })

  it('keeps an ambiguously published job pending and locked', async () => {
    const { ctx, push, redis } = createContext()
    push.mockRejectedValue(new Error('acknowledgement lost'))

    const job = await startCourseDeletion({ id: 'course-id' }, ctx)

    expect(job).toMatchObject({ status: 'PENDING' })
    expect(push).toHaveBeenCalledTimes(2)
    expect(redis.values.get('course-deletion:course:course-id')).toBe(job?.id)

    const repeatedJob = await startCourseDeletion({ id: 'course-id' }, ctx)
    expect(repeatedJob?.id).toBe(job?.id)
  })

  it('republishes a pending job once from the stale-job sweep', async () => {
    const { ctx, push, redis } = createContext()
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    const statusKey = `course-deletion:job:${job!.id}`
    const storedJob = JSON.parse(redis.values.get(statusKey)!)
    storedJob.publicationRecoveryNeeded = true
    storedJob.lastPublicationAttemptAt = Date.now() - 6 * 60 * 1000
    redis.values.set(statusKey, JSON.stringify(storedJob))
    vi.spyOn(redis, 'scan').mockResolvedValue(['0', [statusKey]])

    await expect(
      handleSweepStaleCourseDeletions(
        {},
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)

    expect(push).toHaveBeenCalledTimes(2)
    expect(JSON.parse(redis.values.get(statusKey)!)).toMatchObject({
      publicationRecoveryNeeded: false,
      publicationRecoveryAttempts: 1,
      status: 'PENDING',
    })
  })

  it('does not overwrite a pending job after a worker takes its lease', async () => {
    const { ctx, push, redis } = createContext()
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    const statusKey = `course-deletion:job:${job!.id}`
    const storedJob = JSON.parse(redis.values.get(statusKey)!)
    storedJob.publicationRecoveryNeeded = true
    storedJob.lastPublicationAttemptAt = Date.now() - 6 * 60 * 1000
    redis.values.set(statusKey, JSON.stringify(storedJob))
    redis.values.set(`${statusKey}:processing`, 'worker-token')
    vi.spyOn(redis, 'scan').mockResolvedValue(['0', [statusKey]])

    await expect(
      handleSweepStaleCourseDeletions(
        {},
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)

    expect(push).toHaveBeenCalledOnce()
    expect(JSON.parse(redis.values.get(statusKey)!)).toMatchObject({
      publicationRecoveryNeeded: true,
      status: 'PENDING',
    })
  })

  it('does not terminalize a stale job while a worker owns its lease', async () => {
    const { ctx, redis } = createContext()
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    const statusKey = `course-deletion:job:${job!.id}`
    const storedJob = JSON.parse(redis.values.get(statusKey)!)
    storedJob.createdAt = new Date(Date.now() - 76 * 60 * 1000).toISOString()
    redis.values.set(statusKey, JSON.stringify(storedJob))
    redis.values.set(`${statusKey}:processing`, 'worker-token')

    await expect(
      getCourseDeletionStatuses({ ids: [job!.id] }, ctx)
    ).resolves.toEqual([
      expect.objectContaining({ id: job!.id, status: 'PENDING' }),
    ])
    expect(redis.values.get('course-deletion:course:course-id')).toBe(job!.id)
  })

  it('stops publication recovery at the absolute stale deadline', async () => {
    const { ctx, push, redis } = createContext()
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    const statusKey = `course-deletion:job:${job!.id}`
    const storedJob = JSON.parse(redis.values.get(statusKey)!)
    storedJob.createdAt = new Date(Date.now() - 76 * 60 * 1000).toISOString()
    storedJob.updatedAt = new Date().toISOString()
    storedJob.publicationRecoveryNeeded = true
    storedJob.lastPublicationAttemptAt = Date.now() - 6 * 60 * 1000
    redis.values.set(statusKey, JSON.stringify(storedJob))
    vi.spyOn(redis, 'scan').mockResolvedValue(['0', [statusKey]])

    await expect(
      handleSweepStaleCourseDeletions(
        {},
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)

    expect(push).toHaveBeenCalledOnce()
    expect(JSON.parse(redis.values.get(statusKey)!)).toMatchObject({
      status: 'FAILED',
      errorType: 'generic',
    })
  })

  it('rechecks ADMIN access and completes through the existing service', async () => {
    const { ctx } = createContext()
    const job = await startCourseDeletion(
      { id: 'course-id', deleteDraftActivities: true },
      ctx
    )

    await expect(
      handleProcessCourseDeletion(
        { jobId: job!.id },
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)

    expect(serviceMocks.checkAccess).toHaveBeenLastCalledWith(
      [
        {
          courseId: 'course-id',
          minimumPermissionLevel: PermissionLevel.ADMIN,
        },
      ],
      expect.objectContaining({ user: ctx.user })
    )
    expect(serviceMocks.deleteCourse).toHaveBeenCalledWith(
      { id: 'course-id', deleteDraftActivities: true },
      expect.objectContaining({ user: ctx.user })
    )
    await expect(
      getCourseDeletionStatuses({ ids: [job!.id] }, ctx)
    ).resolves.toEqual([
      expect.objectContaining({ id: job!.id, status: 'COMPLETED' }),
    ])
  })

  it('treats an already absent course as a completed retry', async () => {
    const { ctx, findUnique } = createContext()
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    findUnique.mockResolvedValue(null)

    await expect(
      handleProcessCourseDeletion(
        { jobId: job!.id },
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)

    expect(serviceMocks.deleteCourse).not.toHaveBeenCalled()
    await expect(
      getCourseDeletionStatuses({ ids: [job!.id] }, ctx)
    ).resolves.toEqual([
      expect.objectContaining({ id: job!.id, status: 'COMPLETED' }),
    ])
  })

  it('records revoked access as a terminal failure', async () => {
    const { ctx } = createContext()
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    serviceMocks.checkAccess.mockResolvedValueOnce(false)

    await expect(
      handleProcessCourseDeletion(
        { jobId: job!.id },
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(false)

    expect(serviceMocks.deleteCourse).not.toHaveBeenCalled()
    await expect(
      getCourseDeletionStatuses({ ids: [job!.id] }, ctx)
    ).resolves.toEqual([
      expect.objectContaining({
        id: job!.id,
        status: 'FAILED',
        errorType: 'access',
      }),
    ])
  })

  it('does not delete a course that became an assessment before processing', async () => {
    const { ctx, findUnique } = createContext()
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    findUnique.mockResolvedValue({
      id: 'course-id',
      name: 'Large course',
      isAssessmentEnabled: true,
      liveQuizzes: [],
      practiceQuizzes: [],
      microLearnings: [],
      groupActivities: [],
    })

    await expect(
      handleProcessCourseDeletion(
        { jobId: job!.id },
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(false)

    expect(serviceMocks.deleteCourse).not.toHaveBeenCalled()
    await expect(
      getCourseDeletionStatuses({ ids: [job!.id] }, ctx)
    ).resolves.toEqual([
      expect.objectContaining({
        id: job!.id,
        status: 'FAILED',
        errorType: 'notAllowed',
      }),
    ])
  })

  it('does not overwrite status after losing the process lease', async () => {
    const { ctx, redis } = createContext()
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    serviceMocks.deleteCourse.mockImplementationOnce(async () => {
      const processLockKey = [...redis.values.keys()].find((key) =>
        key.endsWith(':processing')
      )
      if (processLockKey) redis.values.delete(processLockKey)
      return { id: 'course-id' }
    })

    await expect(
      handleProcessCourseDeletion(
        { jobId: job!.id },
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).rejects.toThrow('process lease was lost')

    await expect(
      getCourseDeletionStatuses({ ids: [job!.id] }, ctx)
    ).resolves.toEqual([
      expect.objectContaining({ id: job!.id, status: 'RUNNING' }),
    ])
  })

  it('recovers post-commit scheduled cleanup before marking completion', async () => {
    const { ctx, deleteScheduledTask, findUnique } = createContext()
    const job = await startCourseDeletion(
      { id: 'course-id', deleteDraftActivities: true },
      ctx
    )
    findUnique
      .mockResolvedValueOnce({
        id: 'course-id',
        isAssessmentEnabled: false,
        liveQuizzes: [
          {
            id: 'draft-live-quiz',
            isDeleted: false,
            status: 'DRAFT',
          },
        ],
        practiceQuizzes: [
          { scheduledPublicationTaskId: 'practice-publication' },
        ],
        microLearnings: [
          {
            scheduledPublicationTaskId: 'micro-publication',
            scheduledCompletionTaskId: 'micro-completion',
          },
        ],
        groupActivities: [],
      })
      .mockResolvedValueOnce(null)
    serviceMocks.deleteCourse.mockRejectedValueOnce(
      new Error('worker stopped after commit')
    )

    await expect(
      handleProcessCourseDeletion(
        { jobId: job!.id },
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)

    expect(deleteScheduledTask).toHaveBeenCalledTimes(3)
    expect(deleteScheduledTask).toHaveBeenCalledWith('practice-publication')
    expect(deleteScheduledTask).toHaveBeenCalledWith('micro-publication')
    expect(deleteScheduledTask).toHaveBeenCalledWith('micro-completion')
    expect(ctx.emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'LiveQuiz',
      id: 'draft-live-quiz',
    })
  })

  it('leaves generic failures retryable while the course still exists', async () => {
    const { ctx } = createContext()
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    serviceMocks.deleteCourse.mockRejectedValueOnce(new Error('database busy'))

    await expect(
      handleProcessCourseDeletion(
        { jobId: job!.id },
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).rejects.toThrow('database busy')

    await expect(
      getCourseDeletionStatuses({ ids: [job!.id] }, ctx)
    ).resolves.toEqual([
      expect.objectContaining({ id: job!.id, status: 'RUNNING' }),
    ])
  })
})
