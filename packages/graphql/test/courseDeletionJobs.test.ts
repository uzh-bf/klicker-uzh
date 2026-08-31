import { EventEmitter } from 'node:events'
import {
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { getLiveQuizCourseDeletedKey } from '@klicker-uzh/util'
import type { Redis } from 'ioredis'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'

const serviceMocks = vi.hoisted(() => ({
  deleteCourse: vi.fn(),
}))

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
import { assertCourseDeletionNotInProgress } from '../src/services/courseDeletionGuard.js'

class FakeRedis {
  readonly values = new Map<string, string>()
  readonly mutationFences = new Map<string, Map<string, number>>()

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

  pipeline() {
    const operations: Array<[string, string]> = []
    const pipeline = {
      set: (key: string, value: string) => {
        operations.push([key, value])
        return pipeline
      },
      exec: async () => {
        for (const [key, value] of operations) {
          this.values.set(key, value)
        }
        return operations.map(() => [null, 'OK'])
      },
    }
    return pipeline
  }

  async eval(
    script: string,
    _numKeys: number,
    ...args: Array<string | number>
  ) {
    if (script.includes('ARGV[3] == ""')) {
      const [deletedKey = '', processingKey = '', value = ''] = args.map(String)
      const now = Number(args[3])
      const processing = this.mutationFences.get(processingKey) ?? new Map()
      for (const [token, expiry] of processing) {
        if (expiry <= now) processing.delete(token)
      }
      if (processing.size > 0) return 0
      this.values.set(deletedKey, value)
      return 1
    }

    if (script.includes('zremrangebyscore') && script.includes('zadd')) {
      const [deletionLockKey = '', mutationFenceKey = '', token = ''] =
        args.map(String)
      const now = Number(args[3])
      const expiresAt = Number(args[4])
      const fences = this.mutationFences.get(mutationFenceKey) ?? new Map()
      for (const [fenceToken, fenceExpiry] of fences) {
        if (fenceExpiry <= now) fences.delete(fenceToken)
      }
      if (this.values.has(deletionLockKey)) return 0
      fences.set(token, expiresAt)
      this.mutationFences.set(mutationFenceKey, fences)
      return 1
    }

    if (script.includes('zremrangebyscore') && script.includes('zcard')) {
      const [deletionLockKey = '', mutationFenceKey = '', jobId = ''] =
        args.map(String)
      const now = Number(args[3])
      const fences = this.mutationFences.get(mutationFenceKey) ?? new Map()
      for (const [fenceToken, fenceExpiry] of fences) {
        if (fenceExpiry <= now) fences.delete(fenceToken)
      }
      if (this.values.has(deletionLockKey) || fences.size > 0) return 0
      this.values.set(deletionLockKey, jobId)
      return 1
    }

    if (script.includes('zrem') && script.includes('zcard')) {
      const [mutationFenceKey = '', token = ''] = args.map(String)
      const fences = this.mutationFences.get(mutationFenceKey)
      fences?.delete(token)
      if (fences?.size === 0) this.mutationFences.delete(mutationFenceKey)
      return 1
    }

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

    if (_numKeys === 1 && script.includes('redis.call("set"')) {
      const [statusKey = '', expectedJob = '', updatedJob = ''] =
        args.map(String)
      if (this.values.get(statusKey) !== expectedJob) return 0
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

function createContext(userId = 'user-1', response?: EventEmitter) {
  const redis = new FakeRedis()
  const findUnique = vi.fn().mockResolvedValue({
    id: 'course-id',
    deletionJobId: null,
    isDeletionPending: false,
    name: 'Large course',
    isDeleted: false,
    isAssessmentEnabled: false,
    liveQuizzes: [],
    practiceQuizzes: [],
    microLearnings: [],
    groupActivities: [],
  })
  const findFirst = vi.fn().mockResolvedValue(null)
  const updateMany = vi.fn().mockResolvedValue({ count: 1 })
  const findMany = vi.fn().mockResolvedValue([])
  const findPermission = vi.fn().mockResolvedValue({ id: 'permission-id' })
  const findResponseAdmission = vi.fn().mockResolvedValue(null)
  const findResponseAdmissions = vi.fn().mockResolvedValue([])
  const deleteResponseAdmissions = vi.fn().mockResolvedValue({ count: 0 })
  const updateResponseAdmissions = vi.fn().mockResolvedValue({ count: 1 })
  const push = vi.fn().mockResolvedValue(undefined)
  const getEvent = vi.fn()
  const deleteScheduledTask = vi.fn().mockResolvedValue(undefined)
  const findActivity = vi.fn().mockResolvedValue({
    courseId: 'course-id',
    course: { isDeleted: false, isDeletionPending: false },
  })
  const courseClient = { findFirst, findMany, findUnique, updateMany }
  const ctx = {
    user: {
      sub: userId,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: false,
    },
    prisma: {
      course: courseClient,
      $transaction: vi.fn(
        async (
          callback: (tx: {
            course: typeof courseClient
            $executeRaw: ReturnType<typeof vi.fn>
          }) => unknown
        ) => callback({ course: courseClient, $executeRaw: vi.fn() })
      ),
      derivedPermission: { findUnique: findPermission },
      liveQuizResponseAdmission: {
        deleteMany: deleteResponseAdmissions,
        findFirst: findResponseAdmission,
        findMany: findResponseAdmissions,
        updateMany: updateResponseAdmissions,
      },
      liveQuiz: { findUnique: findActivity },
      practiceQuiz: { findUnique: findActivity },
      microLearning: { findUnique: findActivity },
      groupActivity: { findUnique: findActivity },
    },
    redisExec: redis as unknown as Redis,
    redisAssessmentExec: {} as Redis,
    pubSub: {},
    emitter: { emit: vi.fn() },
    hatchet: {
      api: { eventGet: getEvent },
      events: { push },
      scheduled: { delete: deleteScheduledTask },
    },
    tasks: {},
    req: undefined as never,
    res: response as never,
  } as unknown as ContextWithUser

  return {
    ctx,
    deleteResponseAdmissions,
    deleteScheduledTask,
    findPermission,
    findResponseAdmission,
    findResponseAdmissions,
    findMany,
    findFirst,
    findUnique,
    getEvent,
    push,
    redis,
    updateResponseAdmissions,
    updateMany,
  }
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

  it('allows a delegated course admin to queue deletion', async () => {
    const { ctx, push, updateMany } = createContext()
    ctx.user.scope = UserLoginScope.READ_ONLY

    await expect(
      startCourseDeletion({ id: 'course-id' }, ctx)
    ).resolves.toMatchObject({
      courseId: 'course-id',
      status: 'PENDING',
    })
    expect(push).toHaveBeenCalledOnce()
    expect(updateMany).toHaveBeenCalledOnce()
  })

  it('keeps deletion disabled during the first production rollout', async () => {
    const { ctx, push, updateMany } = createContext()
    const previous = process.env.COURSE_DELETION_ENABLED
    process.env.COURSE_DELETION_ENABLED = 'false'
    try {
      await expect(
        startCourseDeletion({ id: 'course-id' }, ctx)
      ).rejects.toMatchObject({
        extensions: { code: 'COURSE_DELETION_NOT_ENABLED' },
      })
      expect(push).not.toHaveBeenCalled()
      expect(updateMany).not.toHaveBeenCalled()
    } finally {
      if (typeof previous === 'undefined') {
        delete process.env.COURSE_DELETION_ENABLED
      } else {
        process.env.COURSE_DELETION_ENABLED = previous
      }
    }
  })

  it('marks the course pending only after Hatchet accepts the job', async () => {
    const { ctx, findUnique, redis, updateMany } = createContext()
    findUnique.mockResolvedValue({
      id: 'course-id',
      name: 'Large course',
      isDeleted: false,
      isAssessmentEnabled: false,
      liveQuizzes: [
        {
          id: 'live-quiz-id',
          isDeleted: false,
          status: PublicationStatus.PUBLISHED,
          scheduledPublicationTaskId: null,
        },
      ],
      practiceQuizzes: [],
      microLearnings: [],
      groupActivities: [],
    })

    const job = await startCourseDeletion({ id: 'course-id' }, ctx)

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        deletionJobId: null,
        id: 'course-id',
        isDeleted: false,
        isDeletionPending: false,
      },
      data: {
        deletionJobId: job?.id,
        deletionRequestedById: ctx.user.sub,
        deletionPendingAt: expect.any(Date),
        deleteDraftActivitiesOnDeletion: false,
        isDeletionPending: true,
      },
    })
    expect(redis.values.has('lq:live-quiz-id:course-deleted')).toBe(false)
    expect(job).toMatchObject({ isQueued: true })
  })

  it('accepts a job that completes before the pending marker is written', async () => {
    const { ctx, findUnique, updateMany } = createContext()
    updateMany.mockResolvedValue({ count: 0 })
    findUnique
      .mockResolvedValueOnce({
        id: 'course-id',
        name: 'Large course',
        isDeleted: false,
        isDeletionPending: false,
        isAssessmentEnabled: false,
        deletionJobId: null,
        liveQuizzes: [],
        practiceQuizzes: [],
        microLearnings: [],
        groupActivities: [],
      })
      .mockResolvedValueOnce({
        name: 'Large course',
        liveQuizzes: [],
        practiceQuizzes: [],
        microLearnings: [],
        groupActivities: [],
      })
      .mockResolvedValueOnce({ isDeleted: true })

    await expect(
      startCourseDeletion({ id: 'course-id' }, ctx)
    ).resolves.toMatchObject({ isQueued: true })
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

  it('does not start deletion after a course mutation is admitted', async () => {
    const { ctx } = createContext()

    await assertCourseDeletionNotInProgress({ courseId: 'course-id' }, ctx)

    await expect(
      startCourseDeletion({ id: 'course-id' }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'COURSE_MUTATION_IN_PROGRESS' },
    })
  })

  it('allows deletion after the admitted mutation response finishes', async () => {
    const response = new EventEmitter()
    const { ctx, redis } = createContext('user-1', response)

    await assertCourseDeletionNotInProgress({ courseId: 'course-id' }, ctx)
    response.emit('finish')

    await vi.waitFor(() => expect(redis.mutationFences.size).toBe(0))
    await expect(
      startCourseDeletion({ id: 'course-id' }, ctx)
    ).resolves.toMatchObject({ status: 'PENDING' })
  })

  it('rejects course and linked activity writes while deletion is active', async () => {
    const { ctx } = createContext()
    await startCourseDeletion({ id: 'course-id' }, ctx)

    const selectors = [
      { courseId: 'course-id' },
      { liveQuizId: 'live-quiz-id' },
      { practiceQuizId: 'practice-quiz-id' },
      { microLearningId: 'micro-learning-id' },
      { groupActivityId: 'group-activity-id' },
    ] as const

    for (const selector of selectors) {
      await expect(
        assertCourseDeletionNotInProgress(selector, ctx)
      ).rejects.toMatchObject({
        extensions: { code: 'COURSE_DELETION_IN_PROGRESS' },
      })
    }
  })

  it('allows writes when the deletion lock references a terminal job', async () => {
    const { ctx, redis } = createContext()
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    const statusKey = `course-deletion:job:${job!.id}`
    const storedJob = JSON.parse(redis.values.get(statusKey)!)
    redis.values.set(
      statusKey,
      JSON.stringify({ ...storedJob, status: 'FAILED' })
    )

    await expect(
      assertCourseDeletionNotInProgress({ courseId: 'course-id' }, ctx)
    ).resolves.toBeUndefined()
  })

  it('rejects writes after the course has been soft-deleted', async () => {
    const { ctx, findUnique, redis } = createContext()
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    const statusKey = `course-deletion:job:${job!.id}`
    const storedJob = JSON.parse(redis.values.get(statusKey)!)
    redis.values.set(
      statusKey,
      JSON.stringify({ ...storedJob, status: 'COMPLETED' })
    )
    findUnique.mockResolvedValue({
      id: 'course-id',
      isDeleted: true,
    })

    await expect(
      assertCourseDeletionNotInProgress({ courseId: 'course-id' }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'COURSE_DELETED' },
    })
  })

  it('rejects writes when the deletion lock has no readable job', async () => {
    const { ctx, redis } = createContext()
    redis.values.set(
      'course-deletion:course:course-id',
      'missing-course-deletion-job'
    )

    await expect(
      assertCourseDeletionNotInProgress({ courseId: 'course-id' }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'COURSE_DELETION_IN_PROGRESS' },
    })
  })

  it('keeps an ambiguously published job pending and locked', async () => {
    const { ctx, push, redis } = createContext()
    push.mockRejectedValue(new Error('acknowledgement lost'))

    const job = await startCourseDeletion({ id: 'course-id' }, ctx)

    expect(job).toMatchObject({ status: 'PENDING', isQueued: false })
    expect(push).toHaveBeenCalledTimes(2)
    expect(redis.values.get('course-deletion:course:course-id')).toBe(job?.id)

    push.mockResolvedValue(undefined)
    const repeatedJob = await startCourseDeletion({ id: 'course-id' }, ctx)
    expect(repeatedJob).toMatchObject({ id: job?.id, isQueued: true })
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

  it('terminalizes stale admissions after Hatchet confirms all runs ended', async () => {
    const { ctx, findResponseAdmissions, getEvent, updateResponseAdmissions } =
      createContext()
    findResponseAdmissions.mockResolvedValueOnce([
      { eventId: 'hatchet-event-id', token: 'admission-token' },
    ])
    getEvent.mockResolvedValueOnce({
      data: {
        workflowRunSummary: {
          cancelled: 0,
          failed: 1,
          pending: 0,
          queued: 0,
          running: 0,
          succeeded: 0,
        },
      },
    })

    await expect(
      handleSweepStaleCourseDeletions(
        {},
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)

    expect(getEvent).toHaveBeenCalledWith('hatchet-event-id')
    expect(updateResponseAdmissions).toHaveBeenCalledWith({
      where: {
        eventId: 'hatchet-event-id',
        failedAt: null,
        token: 'admission-token',
      },
      data: { failedAt: expect.any(Date) },
    })
  })

  it('keeps stale admissions when Hatchet still has active runs', async () => {
    const { ctx, findResponseAdmissions, getEvent, updateResponseAdmissions } =
      createContext()
    findResponseAdmissions.mockResolvedValueOnce([
      { eventId: 'hatchet-event-id', token: 'admission-token' },
    ])
    getEvent.mockResolvedValueOnce({
      data: {
        workflowRunSummary: {
          failed: 1,
          running: 1,
        },
      },
    })

    await expect(
      handleSweepStaleCourseDeletions(
        {},
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)

    expect(
      updateResponseAdmissions.mock.calls.some(
        ([query]) => query.data.failedAt instanceof Date
      )
    ).toBe(false)
  })

  it('keeps stale admissions when Hatchet status cannot be proven', async () => {
    const { ctx, findResponseAdmissions, getEvent, updateResponseAdmissions } =
      createContext()
    findResponseAdmissions.mockResolvedValueOnce([
      { eventId: 'hatchet-event-id', token: 'admission-token' },
    ])
    getEvent.mockRejectedValueOnce(new Error('Hatchet unavailable'))

    await expect(
      handleSweepStaleCourseDeletions(
        {},
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)

    expect(
      updateResponseAdmissions.mock.calls.some(
        ([query]) => query.data.failedAt instanceof Date
      )
    ).toBe(false)
  })

  it('rotates past a full ambiguous admission batch on the next sweep', async () => {
    const { ctx, findResponseAdmissions, getEvent, updateResponseAdmissions } =
      createContext()
    const admissions = Array.from({ length: 21 }, (_, index) => ({
      eventId: `hatchet-event-${index + 1}`,
      lastReconciliationAttemptAt: null as Date | null,
      token: `admission-token-${index + 1}`,
    }))
    findResponseAdmissions.mockImplementation(async ({ take }) =>
      admissions
        .filter((admission) => !admission.lastReconciliationAttemptAt)
        .slice(0, take)
        .map(({ eventId, token }) => ({ eventId, token }))
    )
    updateResponseAdmissions.mockImplementation(async ({ data, where }) => {
      const admission = admissions.find(
        (candidate) => candidate.token === where.token
      )
      if (!admission) return { count: 0 }

      if (data.lastReconciliationAttemptAt instanceof Date) {
        if (admission.lastReconciliationAttemptAt) return { count: 0 }
        admission.lastReconciliationAttemptAt = data.lastReconciliationAttemptAt
      }
      return { count: 1 }
    })
    getEvent.mockImplementation(async (eventId) => ({
      data: {
        workflowRunSummary:
          eventId === 'hatchet-event-21' ? { failed: 1 } : { running: 1 },
      },
    }))

    await handleSweepStaleCourseDeletions(
      {},
      createGlobalContext(ctx) as never,
      createExecutionContext() as never
    )
    await handleSweepStaleCourseDeletions(
      {},
      createGlobalContext(ctx) as never,
      createExecutionContext() as never
    )

    expect(getEvent).toHaveBeenCalledTimes(21)
    expect(updateResponseAdmissions).toHaveBeenCalledWith({
      where: {
        eventId: 'hatchet-event-21',
        failedAt: null,
        token: 'admission-token-21',
      },
      data: { failedAt: expect.any(Date) },
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

  it('restores a stale pending course when its Redis job disappeared', async () => {
    const { ctx, findMany, redis, updateMany } = createContext()
    const jobId = 'missing-job'
    findMany.mockResolvedValueOnce([
      {
        deletionJobId: jobId,
        id: 'course-id',
        liveQuizzes: [{ id: 'quiz-id' }],
      },
    ])
    redis.values.set('course-deletion:course:course-id', jobId)
    redis.values.set(getLiveQuizCourseDeletedKey('quiz-id'), jobId)

    await expect(
      handleSweepStaleCourseDeletions(
        {},
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(true)

    expect(findMany).toHaveBeenCalledWith({
      where: {
        deletionJobId: { not: null },
        deletionPendingAt: { lte: expect.any(Date) },
        isDeleted: false,
        isDeletionPending: true,
      },
      select: {
        deletionJobId: true,
        id: true,
        liveQuizzes: { select: { id: true } },
      },
    })
    expect(updateMany).toHaveBeenLastCalledWith({
      where: {
        deletionJobId: jobId,
        id: 'course-id',
        isDeleted: false,
        isDeletionPending: true,
      },
      data: {
        deletionJobId: null,
        deletionRequestedById: null,
        deletionPendingAt: null,
        deleteDraftActivitiesOnDeletion: false,
        isDeletionPending: false,
      },
    })
    expect(redis.values.has('course-deletion:course:course-id')).toBe(false)
    expect(redis.values.has(getLiveQuizCourseDeletedKey('quiz-id'))).toBe(false)
  })

  it('keeps polling a durable pending course when its Redis job disappeared', async () => {
    const { ctx, findFirst } = createContext()
    const pendingAt = new Date('2026-08-31T08:00:00.000Z')
    findFirst.mockImplementation(async (query) =>
      query.where.deletionRequestedById === ctx.user.sub
        ? {
            deletionPendingAt: pendingAt,
            id: 'course-id',
            name: 'Large course',
          }
        : null
    )

    await expect(
      getCourseDeletionStatuses({ ids: ['missing-job'] }, ctx)
    ).resolves.toEqual([
      {
        id: 'missing-job',
        status: 'PENDING',
        isQueued: true,
        courseId: 'course-id',
        courseName: 'Large course',
        errorType: null,
        errorMessage: null,
        createdAt: pendingAt,
        updatedAt: pendingAt,
      },
    ])
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        deletionJobId: 'missing-job',
        deletionRequestedById: ctx.user.sub,
        isDeleted: false,
        isDeletionPending: true,
      },
      select: { deletionPendingAt: true, id: true, name: true },
    })

    const otherAdminCtx = {
      ...ctx,
      user: { ...ctx.user, sub: 'user-2' },
    }
    await expect(
      getCourseDeletionStatuses(
        { ids: ['missing-job'] },
        otherAdminCtx as ContextWithUser
      )
    ).resolves.toEqual([])
  })

  it('rechecks ADMIN access and completes through the existing service', async () => {
    const {
      ctx,
      deleteResponseAdmissions,
      findPermission,
      findResponseAdmission,
    } = createContext()
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

    expect(deleteResponseAdmissions).toHaveBeenCalledWith({
      where: {
        courseId: 'course-id',
        OR: [
          { failedAt: { not: null } },
          {
            publishedAt: null,
            createdAt: { lte: expect.any(Date) },
          },
        ],
      },
    })
    expect(findResponseAdmission).toHaveBeenCalledWith({
      where: { courseId: 'course-id', failedAt: null },
      select: { token: true },
    })

    expect(findPermission).toHaveBeenLastCalledWith({
      where: {
        courseId_userId: {
          courseId: 'course-id',
          userId: ctx.user.sub,
        },
        permissionLevel: {
          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
        },
        course: {
          deletionJobId: job!.id,
          isDeleted: false,
          isDeletionPending: true,
        },
      },
      select: { id: true },
    })
    expect(serviceMocks.deleteCourse).toHaveBeenCalledWith(
      {
        deletionJobId: job!.id,
        id: 'course-id',
        deleteDraftActivities: true,
        draftActivityIds: {
          liveQuizIds: [],
          practiceQuizIds: [],
          microLearningIds: [],
          groupActivityIds: [],
        },
      },
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

  it('treats an already soft-deleted course as a completed retry', async () => {
    const { ctx, findUnique } = createContext()
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    findUnique.mockResolvedValue({
      id: 'course-id',
      isDeleted: true,
      isAssessmentEnabled: false,
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
    ).resolves.toBe(true)

    expect(serviceMocks.deleteCourse).not.toHaveBeenCalled()
    await expect(
      getCourseDeletionStatuses({ ids: [job!.id] }, ctx)
    ).resolves.toEqual([
      expect.objectContaining({ id: job!.id, status: 'COMPLETED' }),
    ])
  })

  it('records revoked access as a terminal failure', async () => {
    const { ctx, findPermission, findUnique, redis } = createContext()
    findUnique.mockResolvedValue({
      id: 'course-id',
      name: 'Large course',
      isDeleted: false,
      isAssessmentEnabled: false,
      liveQuizzes: [
        {
          id: 'live-quiz-id',
          isDeleted: false,
          status: PublicationStatus.PUBLISHED,
          scheduledPublicationTaskId: null,
        },
      ],
      practiceQuizzes: [],
      microLearnings: [],
      groupActivities: [],
    })
    const job = await startCourseDeletion({ id: 'course-id' }, ctx)
    findPermission.mockResolvedValueOnce(null)

    await expect(
      handleProcessCourseDeletion(
        { jobId: job!.id },
        createGlobalContext(ctx) as never,
        createExecutionContext() as never
      )
    ).resolves.toBe(false)

    expect(serviceMocks.deleteCourse).not.toHaveBeenCalled()
    expect(redis.values.has('lq:live-quiz-id:course-deleted')).toBe(false)
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
      isDeleted: false,
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

  it('protects retry state after losing the process lease', async () => {
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

    const statusKey = `course-deletion:job:${job!.id}`
    const retryableJob = JSON.parse(redis.values.get(statusKey)!)
    expect(retryableJob.retryProtectedUntil).toBeGreaterThan(Date.now())
    retryableJob.createdAt = new Date(Date.now() - 76 * 60 * 1000).toISOString()
    retryableJob.updatedAt = retryableJob.createdAt
    redis.values.set(statusKey, JSON.stringify(retryableJob))
    redis.values.delete(`${statusKey}:heartbeat`)

    await expect(
      getCourseDeletionStatuses({ ids: [job!.id] }, ctx)
    ).resolves.toEqual([
      expect.objectContaining({ id: job!.id, status: 'RUNNING' }),
    ])
  })

  it('recovers post-commit scheduled cleanup before marking completion', async () => {
    const { ctx, deleteScheduledTask, findUnique, redis } = createContext()
    const courseWithDrafts = {
      id: 'course-id',
      deletionJobId: null,
      isDeletionPending: false,
      name: 'Large course',
      isDeleted: false,
      isAssessmentEnabled: false,
      liveQuizzes: [
        {
          id: 'draft-live-quiz',
          isDeleted: false,
          status: PublicationStatus.DRAFT,
          scheduledPublicationTaskId: 'live-publication',
        },
      ],
      practiceQuizzes: [
        {
          id: 'draft-practice-quiz',
          isDeleted: false,
          status: PublicationStatus.DRAFT,
          scheduledPublicationTaskId: 'practice-publication',
        },
      ],
      microLearnings: [
        {
          id: 'draft-micro-learning',
          isDeleted: false,
          status: PublicationStatus.DRAFT,
          scheduledPublicationTaskId: 'micro-publication',
          scheduledCompletionTaskId: 'micro-completion',
        },
      ],
      groupActivities: [
        {
          id: 'draft-group-activity',
          isDeleted: false,
          status: PublicationStatus.DRAFT,
          scheduledPublicationTaskId: 'group-publication',
          scheduledCompletionTaskId: 'group-completion',
        },
      ],
    }
    findUnique
      .mockResolvedValueOnce(courseWithDrafts)
      .mockResolvedValueOnce(courseWithDrafts)
      .mockResolvedValueOnce(courseWithDrafts)
      .mockResolvedValueOnce({ id: 'course-id', isDeleted: true })
    const job = await startCourseDeletion(
      { id: 'course-id', deleteDraftActivities: true },
      ctx
    )
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

    expect(deleteScheduledTask).toHaveBeenCalledTimes(6)
    expect(deleteScheduledTask).toHaveBeenCalledWith('live-publication')
    expect(deleteScheduledTask).toHaveBeenCalledWith('practice-publication')
    expect(deleteScheduledTask).toHaveBeenCalledWith('micro-publication')
    expect(deleteScheduledTask).toHaveBeenCalledWith('micro-completion')
    expect(deleteScheduledTask).toHaveBeenCalledWith('group-publication')
    expect(deleteScheduledTask).toHaveBeenCalledWith('group-completion')
    expect(redis.values.get('lq:draft-live-quiz:course-deleted')).toBe('1')
    expect(ctx.emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'LiveQuiz',
      id: 'draft-live-quiz',
    })
    expect(ctx.emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'PracticeQuiz',
      id: 'draft-practice-quiz',
    })
    expect(ctx.emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'MicroLearning',
      id: 'draft-micro-learning',
    })
    expect(ctx.emitter.emit).toHaveBeenCalledWith('invalidate', {
      typename: 'GroupActivity',
      id: 'draft-group-activity',
    })
  })

  it('leaves generic failures retryable while the course still exists', async () => {
    const { ctx, redis } = createContext()
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

    const statusKey = `course-deletion:job:${job!.id}`
    const retryableJob = JSON.parse(redis.values.get(statusKey)!)
    expect(retryableJob.retryProtectedUntil).toBeGreaterThan(Date.now())
    retryableJob.createdAt = new Date(Date.now() - 76 * 60 * 1000).toISOString()
    retryableJob.updatedAt = retryableJob.createdAt
    redis.values.set(statusKey, JSON.stringify(retryableJob))
    redis.values.delete(`${statusKey}:heartbeat`)

    await expect(
      getCourseDeletionStatuses({ ids: [job!.id] }, ctx)
    ).resolves.toEqual([
      expect.objectContaining({ id: job!.id, status: 'RUNNING' }),
    ])
  })
})
