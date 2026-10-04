import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import {
  AsyncTaskKind,
  AsyncTaskStatus,
  Locale,
  type PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  ASYNC_TASK_TRACKED_IDS_LIMIT,
  COURSE_DUPLICATION_ERROR_CODES,
} from '@klicker-uzh/types'
import { createYoga } from 'graphql-yoga'
import type { ContextWithUser } from '@/lib/context.js'
import {
  acknowledgeAsyncTasks,
  type CourseDuplicationTaskSnapshot,
  getAsyncTaskAttentionCount,
  getAsyncTasks,
  syncCourseDuplicationTask,
} from '@/services/asyncTasks.js'
import { schema } from '../src/index.js'
import {
  getCourseDuplicationStatuses,
  handleProcessCourseDuplication,
  handleSweepStaleCourseDuplications,
  startCourseDuplication,
} from '../src/services/courseDuplication.js'
import { getCourseDuplicationStatusKey } from '../src/services/courseDuplicationShared.js'
import { createCourse } from '../src/services/courses.js'
import { initializePrisma } from './helpers.js'

describe('AsyncTask service and GraphQL API', () => {
  let prisma: PrismaClient
  let ownerId: string
  let otherOwnerId: string
  let ownerCtx: ContextWithUser
  let otherOwnerCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
  })

  beforeEach(async () => {
    ownerId = randomUUID()
    otherOwnerId = randomUUID()

    await prisma.user.createMany({
      data: [
        syntheticUser(ownerId, 'owner'),
        syntheticUser(otherOwnerId, 'other'),
      ],
    })

    ownerCtx = contextFor(ownerId)
    otherOwnerCtx = contextFor(otherOwnerId)
  })

  afterEach(async () => {
    await prisma.course.deleteMany({
      where: { ownerId: { in: [ownerId, otherOwnerId] } },
    })
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, otherOwnerId] } },
    })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  function syntheticUser(id: string, label: string) {
    return {
      id,
      email: `${label}-${id}@invalid.example`,
      shortname: `${label}-${id}`,
      role: UserRole.USER,
    }
  }

  function contextFor(sub: string): ContextWithUser {
    return {
      prisma,
      redisExec: {
        get: async () => null,
        mget: async (...keys: string[]) => keys.map(() => 'present'),
        set: async () => 'OK',
      },
      user: {
        sub,
        role: UserRole.USER,
        scope: UserLoginScope.ACCOUNT_OWNER,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
    } as unknown as ContextWithUser
  }

  async function executeGraphql({
    source,
    context = ownerCtx,
    variables,
  }: {
    source: string
    context?: ContextWithUser
    variables?: Record<string, unknown>
  }) {
    const yoga = createYoga({
      schema,
      context: () => context,
      graphqlEndpoint: '/graphql',
    })
    const response = await yoga.fetch('http://localhost/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: source, variables }),
    })

    return (await response.json()) as {
      data?: Record<string, unknown>
      errors?: { message: string; extensions?: { code?: string } }[]
    }
  }

  function courseDuplicationSnapshot(
    overrides: Partial<CourseDuplicationTaskSnapshot> = {}
  ): CourseDuplicationTaskSnapshot {
    const now = new Date()

    return {
      id: randomUUID(),
      status: 'PENDING',
      sourceCourseId: randomUUID(),
      sourceCourseName: 'Source course',
      targetCourseName: 'Copied course',
      createdAt: now,
      updatedAt: now,
      userId: ownerId,
      ...overrides,
    }
  }

  function createSyntheticCourse(courseId?: string, ctx = ownerCtx) {
    return createCourse(
      {
        courseId,
        name: 'Synthetic recovery course',
        displayName: 'Synthetic recovery course',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        language: Locale.en,
        isGamificationEnabled: false,
      },
      ctx
    )
  }

  it('returns only the owner active tasks and recent terminal tasks', async () => {
    const now = new Date()
    const oldTerminalDate = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)

    await prisma.asyncTask.createMany({
      data: [
        {
          id: randomUUID(),
          kind: AsyncTaskKind.COURSE_DUPLICATION,
          status: AsyncTaskStatus.RUNNING,
          subjectName: 'Active owner task',
          ownerId,
        },
        {
          id: randomUUID(),
          kind: AsyncTaskKind.QUESTION_GENERATION,
          status: AsyncTaskStatus.SUCCEEDED,
          subjectName: 'Recent owner task',
          finishedAt: now,
          ownerId,
        },
        {
          id: randomUUID(),
          kind: AsyncTaskKind.KNOWLEDGE_GRAPH_GENERATION,
          status: AsyncTaskStatus.FAILED,
          subjectName: 'Expired owner task',
          finishedAt: oldTerminalDate,
          ownerId,
        },
        {
          id: randomUUID(),
          kind: AsyncTaskKind.COURSE_DUPLICATION,
          status: AsyncTaskStatus.RUNNING,
          subjectName: 'Other owner task',
          ownerId: otherOwnerId,
        },
      ],
    })

    const tasks = await getAsyncTasks({ trackedIds: [] }, ownerCtx)

    expect(tasks.map((task) => task.subjectName)).toEqual([
      'Active owner task',
      'Recent owner task',
    ])
  })

  it('does not return expired terminal tasks requested through tracked ids', async () => {
    const expiredTask = await prisma.asyncTask.create({
      data: {
        kind: AsyncTaskKind.QUESTION_GENERATION,
        status: AsyncTaskStatus.SUCCEEDED,
        subjectName: 'Expired tracked task',
        finishedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        ownerId,
      },
    })

    const result = await executeGraphql({
      source: `
        query AsyncTasks($trackedIds: [String!]!) {
          asyncTasks(trackedIds: $trackedIds) { id }
        }
      `,
      variables: { trackedIds: [expiredTask.id] },
    })

    expect(result.errors).toBeUndefined()
    expect(result.data?.asyncTasks).toEqual([])
  })

  it('counts every active and unread recent task beyond the row limits', async () => {
    const now = Date.now()
    await prisma.asyncTask.createMany({
      data: [
        ...Array.from({ length: 51 }, (_, index) => ({
          kind: AsyncTaskKind.COURSE_DUPLICATION,
          status: AsyncTaskStatus.QUEUED,
          subjectName: `Active task ${index}`,
          ownerId,
          createdAt: new Date(now - index * 1000),
        })),
        ...Array.from({ length: 21 }, (_, index) => ({
          kind: AsyncTaskKind.QUESTION_GENERATION,
          status: AsyncTaskStatus.SUCCEEDED,
          subjectName: `Unread task ${index}`,
          ownerId,
          finishedAt: new Date(now - index * 1000),
        })),
        {
          kind: AsyncTaskKind.QUESTION_GENERATION,
          status: AsyncTaskStatus.SUCCEEDED,
          subjectName: 'Read task',
          ownerId,
          finishedAt: new Date(now),
          readAt: new Date(now),
        },
        {
          kind: AsyncTaskKind.QUESTION_GENERATION,
          status: AsyncTaskStatus.FAILED,
          subjectName: 'Expired task',
          ownerId,
          finishedAt: new Date(now - 8 * 24 * 60 * 60 * 1000),
        },
        {
          kind: AsyncTaskKind.KNOWLEDGE_GRAPH_GENERATION,
          status: AsyncTaskStatus.RUNNING,
          subjectName: 'Other owner task',
          ownerId: otherOwnerId,
        },
      ],
    })

    const [attentionCount, tasks] = await Promise.all([
      getAsyncTaskAttentionCount(ownerCtx),
      getAsyncTasks({ trackedIds: [] }, ownerCtx),
    ])

    expect(attentionCount).toBe(72)
    expect(tasks).toHaveLength(70)
    expect(
      tasks.filter((task) => task.status === AsyncTaskStatus.QUEUED)
    ).toHaveLength(50)
    expect(tasks.filter((task) => task.readAt === null)).toHaveLength(70)
  })

  it('acknowledges only unread terminal tasks owned by the caller', async () => {
    const [terminalTask, activeTask, otherOwnerTask] = await Promise.all([
      prisma.asyncTask.create({
        data: {
          kind: AsyncTaskKind.QUESTION_GENERATION,
          status: AsyncTaskStatus.FAILED,
          subjectName: 'Failed questions',
          finishedAt: new Date(),
          ownerId,
        },
      }),
      prisma.asyncTask.create({
        data: {
          kind: AsyncTaskKind.KNOWLEDGE_GRAPH_GENERATION,
          status: AsyncTaskStatus.RUNNING,
          subjectName: 'Running graph',
          ownerId,
        },
      }),
      prisma.asyncTask.create({
        data: {
          kind: AsyncTaskKind.COURSE_DUPLICATION,
          status: AsyncTaskStatus.SUCCEEDED,
          subjectName: 'Other course',
          finishedAt: new Date(),
          ownerId: otherOwnerId,
        },
      }),
    ])

    const count = await acknowledgeAsyncTasks(
      {
        ids: [
          terminalTask.id,
          terminalTask.id,
          activeTask.id,
          otherOwnerTask.id,
        ],
      },
      ownerCtx
    )

    expect(count).toBe(1)
    const [acknowledged, active, otherOwner] = await Promise.all([
      prisma.asyncTask.findUniqueOrThrow({ where: { id: terminalTask.id } }),
      prisma.asyncTask.findUniqueOrThrow({ where: { id: activeTask.id } }),
      prisma.asyncTask.findUniqueOrThrow({ where: { id: otherOwnerTask.id } }),
    ])
    expect(acknowledged.readAt).toBeInstanceOf(Date)
    expect(active.readAt).toBeNull()
    expect(otherOwner.readAt).toBeNull()
  })

  it('rejects acknowledgement batches larger than fifty unique tasks', async () => {
    await expect(
      acknowledgeAsyncTasks(
        { ids: Array.from({ length: 51 }, () => randomUUID()) },
        ownerCtx
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
  })

  it('rejects malformed acknowledgement ids through GraphQL', async () => {
    const result = await executeGraphql({
      source: `
        mutation Acknowledge($ids: [String!]!) {
          acknowledgeAsyncTasks(ids: $ids)
        }
      `,
      variables: { ids: ['not-a-uuid'] },
    })

    expect(result.errors).toEqual([
      expect.objectContaining({
        message: expect.stringMatching(/uuid/i),
      }),
    ])
  })

  it('rejects tracked-task batches larger than the shared limit', async () => {
    await expect(
      getAsyncTasks(
        {
          trackedIds: Array.from(
            { length: ASYNC_TASK_TRACKED_IDS_LIMIT + 1 },
            () => randomUUID()
          ),
        },
        ownerCtx
      )
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
  })

  it('rejects malformed tracked-task ids before querying UUID columns', async () => {
    await expect(
      getAsyncTasks({ trackedIds: ['not-a-uuid'] }, ownerCtx)
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } })
  })

  it('rejects oversized tracked-id lists through GraphQL', async () => {
    const repeatedId = randomUUID()
    const result = await executeGraphql({
      source: `
        query AsyncTasks($trackedIds: [String!]!) {
          asyncTasks(trackedIds: $trackedIds) { id }
        }
      `,
      variables: {
        trackedIds: Array.from(
          { length: ASYNC_TASK_TRACKED_IDS_LIMIT + 1 },
          () => repeatedId
        ),
      },
    })

    expect(result.errors).toEqual([
      expect.objectContaining({
        message: expect.stringMatching(/50/),
      }),
    ])
  })

  it('surfaces older unread tasks after the newest outcomes are acknowledged', async () => {
    const now = Date.now()
    await prisma.asyncTask.createMany({
      data: Array.from({ length: 21 }, (_, index) => ({
        kind: AsyncTaskKind.QUESTION_GENERATION,
        status: AsyncTaskStatus.SUCCEEDED,
        subjectName: `Generated questions ${index}`,
        finishedAt: new Date(now - index * 1000),
        ownerId,
      })),
    })

    const oldestTask = await prisma.asyncTask.findFirstOrThrow({
      where: { ownerId },
      orderBy: [{ finishedAt: 'asc' }, { id: 'asc' }],
    })
    const trackedPage = await getAsyncTasks(
      { trackedIds: [oldestTask.id] },
      ownerCtx
    )
    expect(trackedPage).toHaveLength(21)
    expect(trackedPage).toContainEqual(
      expect.objectContaining({ id: oldestTask.id })
    )

    const firstPage = await getAsyncTasks({ trackedIds: [] }, ownerCtx)
    expect(firstPage).toHaveLength(20)
    expect(firstPage.every((task) => task.readAt === null)).toBe(true)

    await acknowledgeAsyncTasks(
      { ids: firstPage.map((task) => task.id) },
      ownerCtx
    )
    const secondPage = await getAsyncTasks({ trackedIds: [] }, ownerCtx)

    expect(secondPage).toHaveLength(20)
    expect(secondPage.filter((task) => task.readAt === null)).toHaveLength(1)
    expect(secondPage).toContainEqual(
      expect.objectContaining({ subjectName: 'Generated questions 20' })
    )
  })

  it('fails a stale active duplication task when its Redis job disappeared', async () => {
    const task = await prisma.asyncTask.create({
      data: {
        kind: AsyncTaskKind.COURSE_DUPLICATION,
        status: AsyncTaskStatus.RUNNING,
        subjectName: 'Missing duplication',
        ownerId,
        updatedAt: new Date(Date.now() - 76 * 60 * 1000),
      },
    })
    let reconciliationCursor: string | null = null
    ownerCtx.redisExec = {
      get: async () => reconciliationCursor,
      mget: async (...keys: string[]) => keys.map(() => null),
      set: async (_key: string, value: string) => {
        reconciliationCursor = value
        return 'OK'
      },
    } as unknown as ContextWithUser['redisExec']

    const tasks = await getAsyncTasks({ trackedIds: [] }, ownerCtx)

    expect(tasks).toContainEqual(
      expect.objectContaining({
        id: task.id,
        status: AsyncTaskStatus.FAILED,
        errorCode: COURSE_DUPLICATION_ERROR_CODES.failed,
      })
    )
  })

  it('reconciles a stale task between both display-limit windows', async () => {
    const now = Date.now()
    const staleTask = await prisma.asyncTask.create({
      data: {
        kind: AsyncTaskKind.COURSE_DUPLICATION,
        status: AsyncTaskStatus.RUNNING,
        subjectName: 'Hidden missing duplication',
        ownerId,
        createdAt: new Date(now - 51 * 1000),
        updatedAt: new Date(now - 76 * 60 * 1000),
      },
    })
    await prisma.asyncTask.createMany({
      data: [
        ...Array.from({ length: 50 }, (_, index) => ({
          kind: AsyncTaskKind.COURSE_DUPLICATION,
          status: AsyncTaskStatus.QUEUED,
          subjectName: `Older duplication ${index}`,
          ownerId,
          createdAt: new Date(now - (101 - index) * 1000),
        })),
        ...Array.from({ length: 50 }, (_, index) => ({
          kind: AsyncTaskKind.COURSE_DUPLICATION,
          status: AsyncTaskStatus.QUEUED,
          subjectName: `Newer duplication ${index}`,
          ownerId,
          createdAt: new Date(now - (50 - index) * 1000),
        })),
      ],
    })
    let reconciliationCursor: string | null = null
    ownerCtx.redisExec = {
      get: async () => reconciliationCursor,
      mget: async (...keys: string[]) =>
        keys.map((key) => (key.includes(staleTask.id) ? null : 'present')),
      set: async (_key: string, value: string) => {
        reconciliationCursor = value
        return 'OK'
      },
    } as unknown as ContextWithUser['redisExec']

    const tasks = await getAsyncTasks({ trackedIds: [] }, ownerCtx)

    expect(tasks).toContainEqual(
      expect.objectContaining({
        id: staleTask.id,
        status: AsyncTaskStatus.FAILED,
        errorCode: COURSE_DUPLICATION_ERROR_CODES.failed,
      })
    )
  })

  it('advances through stale batches when older Redis jobs still exist', async () => {
    const now = Date.now()
    const staleTaskId = randomUUID()
    await prisma.asyncTask.createMany({
      data: [
        ...Array.from({ length: 60 }, (_, index) => ({
          kind: AsyncTaskKind.COURSE_DUPLICATION,
          status: AsyncTaskStatus.QUEUED,
          subjectName: `Older active duplication ${index}`,
          ownerId,
          createdAt: new Date(now - (300 - index) * 1000),
        })),
        ...Array.from({ length: 50 }, (_, index) => ({
          kind: AsyncTaskKind.COURSE_DUPLICATION,
          status: AsyncTaskStatus.RUNNING,
          subjectName: `Stale present duplication ${index}`,
          ownerId,
          createdAt: new Date(now - (200 - index) * 1000),
          updatedAt: new Date(now - (200 + index) * 60 * 1000),
        })),
        {
          id: staleTaskId,
          kind: AsyncTaskKind.COURSE_DUPLICATION,
          status: AsyncTaskStatus.RUNNING,
          subjectName: 'Stale task after present batch',
          ownerId,
          createdAt: new Date(now - 100 * 1000),
          updatedAt: new Date(now - 76 * 60 * 1000),
        },
        ...Array.from({ length: 60 }, (_, index) => ({
          kind: AsyncTaskKind.COURSE_DUPLICATION,
          status: AsyncTaskStatus.QUEUED,
          subjectName: `Newer active duplication ${index}`,
          ownerId,
          createdAt: new Date(now - (60 - index) * 1000),
        })),
      ],
    })

    let reconciliationCursor: string | null = null
    ownerCtx.redisExec = {
      get: async () => reconciliationCursor,
      mget: async (...keys: string[]) =>
        keys.map((key) => (key.includes(staleTaskId) ? null : 'present')),
      set: async (_key: string, value: string) => {
        reconciliationCursor = value
        return 'OK'
      },
    } as unknown as ContextWithUser['redisExec']

    await getAsyncTasks({ trackedIds: [] }, ownerCtx)
    await expect(
      prisma.asyncTask.findUniqueOrThrow({ where: { id: staleTaskId } })
    ).resolves.toMatchObject({ status: AsyncTaskStatus.RUNNING })

    const secondPage = await getAsyncTasks({ trackedIds: [] }, ownerCtx)

    expect(secondPage).toContainEqual(
      expect.objectContaining({
        id: staleTaskId,
        status: AsyncTaskStatus.FAILED,
        errorCode: COURSE_DUPLICATION_ERROR_CODES.failed,
      })
    )
  })

  it('does not advance the reconciliation cursor past a failed update', async () => {
    const now = Date.now()
    const failedTask = await prisma.asyncTask.create({
      data: {
        kind: AsyncTaskKind.COURSE_DUPLICATION,
        status: AsyncTaskStatus.RUNNING,
        subjectName: 'Retry this reconciliation',
        ownerId,
        updatedAt: new Date(now - 76 * 60 * 1000),
      },
    })
    const successfulTask = await prisma.asyncTask.create({
      data: {
        kind: AsyncTaskKind.COURSE_DUPLICATION,
        status: AsyncTaskStatus.RUNNING,
        subjectName: 'Reconcile independently',
        ownerId,
        updatedAt: new Date(now - 77 * 60 * 1000),
      },
    })
    let reconciliationCursor: string | null = null
    ownerCtx.redisExec = {
      get: async () => reconciliationCursor,
      mget: async (...keys: string[]) => keys.map(() => null),
      set: async (_key: string, value: string) => {
        reconciliationCursor = value
        return 'OK'
      },
    } as unknown as ContextWithUser['redisExec']

    const originalAsyncTask = prisma.asyncTask
    const asyncTaskWithFailure = new Proxy(originalAsyncTask, {
      get(target, property, receiver) {
        if (property !== 'updateMany') {
          const value = Reflect.get(target, property, receiver)
          return typeof value === 'function' ? value.bind(target) : value
        }

        return async (
          args: Parameters<typeof originalAsyncTask.updateMany>[0]
        ) => {
          if (args.where?.id === failedTask.id) {
            throw new Error('temporary database failure')
          }
          return await originalAsyncTask.updateMany(args)
        }
      },
    })
    ownerCtx.prisma = new Proxy(prisma, {
      get(target, property, receiver) {
        if (property === 'asyncTask') return asyncTaskWithFailure
        const value = Reflect.get(target, property, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })

    try {
      await getAsyncTasks({ trackedIds: [] }, ownerCtx)
    } finally {
      ownerCtx.prisma = prisma
    }

    expect(reconciliationCursor).toBeNull()
    await expect(
      prisma.asyncTask.findUniqueOrThrow({ where: { id: failedTask.id } })
    ).resolves.toMatchObject({ status: AsyncTaskStatus.RUNNING })
    await expect(
      prisma.asyncTask.findUniqueOrThrow({ where: { id: successfulTask.id } })
    ).resolves.toMatchObject({ status: AsyncTaskStatus.FAILED })

    await getAsyncTasks({ trackedIds: [] }, ownerCtx)

    expect(reconciliationCursor).not.toBeNull()
    await expect(
      prisma.asyncTask.findUniqueOrThrow({ where: { id: failedTask.id } })
    ).resolves.toMatchObject({ status: AsyncTaskStatus.FAILED })
  })

  it('mirrors course duplication monotonically and preserves acknowledgement', async () => {
    const id = randomUUID()
    const createdAt = new Date('2026-08-28T08:00:00.000Z')
    const runningAt = new Date('2026-08-28T08:01:00.000Z')
    const completedAt = new Date('2026-08-28T08:02:00.000Z')
    const resultId = randomUUID()

    await syncCourseDuplicationTask(
      courseDuplicationSnapshot({ id, createdAt, updatedAt: createdAt }),
      prisma
    )
    await syncCourseDuplicationTask(
      courseDuplicationSnapshot({
        id,
        status: 'RUNNING',
        createdAt,
        updatedAt: runningAt,
      }),
      prisma
    )
    await syncCourseDuplicationTask(
      courseDuplicationSnapshot({
        id,
        status: 'COMPLETED',
        createdAt,
        updatedAt: completedAt,
        createdCourseId: resultId,
      }),
      prisma
    )
    await prisma.asyncTask.update({
      where: { id },
      data: { readAt: new Date() },
    })

    await syncCourseDuplicationTask(
      courseDuplicationSnapshot({
        id,
        status: 'FAILED',
        errorType: 'generic',
        createdAt,
        updatedAt: new Date('2026-08-28T08:03:00.000Z'),
      }),
      prisma
    )

    const task = await prisma.asyncTask.findUniqueOrThrow({ where: { id } })
    expect(task).toMatchObject({
      status: AsyncTaskStatus.SUCCEEDED,
      resultId,
      errorCode: null,
      startedAt: runningAt,
      finishedAt: completedAt,
    })
    expect(task.readAt).toBeInstanceOf(Date)
  })

  it('repairs a publish failure when an already-running worker commits the course', async () => {
    const args = {
      name: 'Synthetic race source',
      displayName: 'Synthetic race source',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      groupDeadlineDate: new Date('2026-12-31'),
      isGroupCreationEnabled: false,
      maxGroupSize: 5,
      preferredGroupSize: 3,
      language: Locale.en,
      isGamificationEnabled: false,
    }
    const source = await createCourse(args, ownerCtx)
    const stored = new Map<string, string>()
    const redis = {
      get: async (key: string) => stored.get(key) ?? null,
      mget: async (...keys: string[]) =>
        keys.map((key) => stored.get(key) ?? null),
      set: async (key: string, value: string, ...options: unknown[]) => {
        if (options.includes('NX') && stored.has(key)) return null
        stored.set(key, value)
        return 'OK'
      },
      eval: async (
        _script: string,
        _count: number,
        key: string,
        value: string
      ) => {
        if (stored.get(key) !== value) return 0
        return Number(stored.delete(key))
      },
    }
    let signalCopying!: () => void
    let releaseCopy!: () => void
    const copying = new Promise<void>((resolve) => {
      signalCopying = resolve
    })
    const finishCopy = new Promise<void>((resolve) => {
      releaseCopy = resolve
    })
    const pausedCourse = new Proxy(prisma.course, {
      get(target, property, receiver) {
        if (property === 'findUnique') {
          return async (query: Parameters<typeof target.findUnique>[0]) => {
            if (query.where.id === source.id && query.include) {
              signalCopying()
              await finishCopy
            }
            return target.findUnique(query)
          }
        }
        const value = Reflect.get(target, property, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const workerPrisma = new Proxy(prisma, {
      get(target, property, receiver) {
        if (property === 'course') return pausedCourse
        const value = Reflect.get(target, property, receiver)
        return typeof value === 'function' ? value.bind(target) : value
      },
    })
    const logger = { error: vi.fn(), warn: vi.fn(), info: vi.fn() }
    let worker: Promise<boolean> | undefined
    let jobId = ''
    const ctx = {
      ...ownerCtx,
      prisma: workerPrisma,
      redisExec: redis,
      emitter: new EventEmitter(),
      hatchet: {
        events: {
          push: async (_event: string, payload: { jobId: string }) => {
            if (!worker) {
              jobId = payload.jobId
              worker = handleProcessCourseDuplication(
                payload,
                ctx as never,
                { logger } as never
              )
              // Do not fail publication until the real worker is inside copying.
              await Promise.race([
                copying,
                worker.then(() => {
                  throw new Error('Worker finished before the race barrier')
                }),
              ])
            }
            throw new Error('Synthetic lost Hatchet acknowledgement')
          },
        },
      },
    } as unknown as ContextWithUser

    try {
      await expect(
        startCourseDuplication({ ...args, sourceCourseId: source.id }, ctx)
      ).rejects.toMatchObject({
        extensions: { code: COURSE_DUPLICATION_ERROR_CODES.startFailed },
      })
      expect(await getAsyncTasks({ trackedIds: [jobId] }, ctx)).toEqual([
        expect.objectContaining({
          id: jobId,
          status: AsyncTaskStatus.FAILED,
          resultId: null,
        }),
      ])

      releaseCopy()
      await expect(worker).resolves.toBe(true)
      expect(await getAsyncTasks({ trackedIds: [jobId] }, ctx)).toEqual([
        expect.objectContaining({
          id: jobId,
          status: AsyncTaskStatus.SUCCEEDED,
          resultId: jobId,
          errorCode: null,
        }),
      ])
      expect(await getCourseDuplicationStatuses({ ids: [jobId] }, ctx)).toEqual(
        [
          expect.objectContaining({
            id: jobId,
            status: 'COMPLETED',
            createdCourseId: jobId,
          }),
        ]
      )
    } finally {
      releaseCopy()
      await worker?.catch(() => undefined)
    }
  })

  it.each([
    'worker retry',
    'status query',
    'sweep',
  ] as const)('repairs a failed task through %s without losing acknowledgement', async (operation) => {
    const course = await createSyntheticCourse()
    const job = courseDuplicationSnapshot({
      id: course.id,
      status: 'FAILED',
      errorType: 'generic',
    })
    await syncCourseDuplicationTask(job, prisma)
    await acknowledgeAsyncTasks({ ids: [job.id] }, ownerCtx)
    const [failedTask] = await getAsyncTasks({ trackedIds: [job.id] }, ownerCtx)
    const completed = {
      ...job,
      status: 'COMPLETED',
      createdCourseId: job.id,
      updatedAt: new Date(),
    }
    const key = getCourseDuplicationStatusKey(job.id)
    const ctx = {
      ...ownerCtx,
      redisExec: {
        ...ownerCtx.redisExec,
        get: async (lookup: string) =>
          lookup === key ? JSON.stringify(completed) : null,
        scan: async () => ['0', [key]],
        eval: async () => 0,
      },
    } as unknown as ContextWithUser
    const execution = {
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    }

    if (operation === 'worker retry') {
      await handleProcessCourseDuplication(
        { jobId: job.id },
        ctx as never,
        execution as never
      )
    } else if (operation === 'status query') {
      await getCourseDuplicationStatuses({ ids: [job.id] }, ctx)
    } else {
      await handleSweepStaleCourseDuplications(
        {},
        ctx as never,
        execution as never
      )
    }

    expect(await getAsyncTasks({ trackedIds: [job.id] }, ctx)).toEqual([
      expect.objectContaining({
        id: job.id,
        status: AsyncTaskStatus.SUCCEEDED,
        resultId: job.id,
        errorCode: null,
        readAt: failedTask!.readAt,
      }),
    ])
  })

  it.each([
    'uncommitted',
    'mismatched result',
    'foreign owner',
  ] as const)('does not repair failure from an unverified completion: %s', async (condition) => {
    const id = randomUUID()
    if (condition !== 'uncommitted') {
      await createSyntheticCourse(
        id,
        condition === 'foreign owner' ? otherOwnerCtx : ownerCtx
      )
    }
    const job = courseDuplicationSnapshot({
      id,
      status: 'FAILED',
      errorType: 'generic',
    })
    await syncCourseDuplicationTask(job, prisma)
    await syncCourseDuplicationTask(
      {
        ...job,
        status: 'COMPLETED',
        createdCourseId: condition === 'mismatched result' ? randomUUID() : id,
      },
      prisma
    )
    expect(await getAsyncTasks({ trackedIds: [id] }, ownerCtx)).toEqual([
      expect.objectContaining({
        id,
        status: AsyncTaskStatus.FAILED,
        resultId: null,
      }),
    ])
  })

  it('rejects task ids owned by another producer with a stable error code', async () => {
    const id = randomUUID()
    await prisma.asyncTask.create({
      data: {
        id,
        kind: AsyncTaskKind.QUESTION_GENERATION,
        status: AsyncTaskStatus.QUEUED,
        subjectName: 'Generated questions',
        ownerId,
      },
    })

    await expect(
      syncCourseDuplicationTask(courseDuplicationSnapshot({ id }), prisma)
    ).rejects.toMatchObject({
      message: `Async task ${id} belongs to another producer`,
      extensions: { code: 'ASYNC_TASK_PRODUCER_CONFLICT' },
    })
  })

  it('enforces owner scope through the GraphQL query and mutation', async () => {
    const ownerTask = await prisma.asyncTask.create({
      data: {
        kind: AsyncTaskKind.COURSE_DUPLICATION,
        status: AsyncTaskStatus.SUCCEEDED,
        subjectName: 'Owner source',
        targetName: 'Owner copy',
        finishedAt: new Date(),
        ownerId,
      },
    })
    const otherOwnerTask = await prisma.asyncTask.create({
      data: {
        kind: AsyncTaskKind.COURSE_DUPLICATION,
        status: AsyncTaskStatus.SUCCEEDED,
        subjectName: 'Other source',
        targetName: 'Other copy',
        finishedAt: new Date(),
        ownerId: otherOwnerId,
      },
    })

    const queryResult = await executeGraphql({
      source: `
        query AsyncTasks($trackedIds: [String!]!) {
          asyncTaskAttentionCount
          asyncTasks(trackedIds: $trackedIds) { id subjectName }
        }
      `,
      variables: { trackedIds: [otherOwnerTask.id] },
    })
    expect(queryResult.errors).toBeUndefined()
    expect(queryResult.data?.asyncTaskAttentionCount).toBe(1)
    expect(queryResult.data?.asyncTasks).toEqual([
      { id: ownerTask.id, subjectName: 'Owner source' },
    ])

    const mutationResult = await executeGraphql({
      source: `
        mutation Acknowledge($ids: [String!]!) {
          acknowledgeAsyncTasks(ids: $ids)
        }
      `,
      context: otherOwnerCtx,
      variables: { ids: [ownerTask.id, otherOwnerTask.id] },
    })
    expect(mutationResult.errors).toBeUndefined()
    expect(mutationResult.data?.acknowledgeAsyncTasks).toBe(1)

    const [ownerAfterMutation, otherOwnerAfterMutation] = await Promise.all([
      prisma.asyncTask.findUniqueOrThrow({ where: { id: ownerTask.id } }),
      prisma.asyncTask.findUniqueOrThrow({ where: { id: otherOwnerTask.id } }),
    ])
    expect(ownerAfterMutation.readAt).toBeNull()
    expect(otherOwnerAfterMutation.readAt).toBeInstanceOf(Date)
  })
})
