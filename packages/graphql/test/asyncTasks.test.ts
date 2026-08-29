import { randomUUID } from 'node:crypto'
import {
  AsyncTaskKind,
  AsyncTaskStatus,
  type PrismaClient,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { COURSE_DUPLICATION_ERROR_CODES } from '@klicker-uzh/types'
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
        mget: async (...keys: string[]) => keys.map(() => 'present'),
      },
      user: {
        sub,
        role: UserRole.USER,
        scope: UserLoginScope.ACCOUNT_OWNER,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
    } as ContextWithUser
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

  it('returns only the owner active tasks and recent terminal tasks', async () => {
    const now = new Date()
    const oldTerminalDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)

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

    const tasks = await getAsyncTasks(ownerCtx)

    expect(tasks.map((task) => task.subjectName)).toEqual([
      'Active owner task',
      'Recent owner task',
    ])
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
          finishedAt: new Date(now - 31 * 24 * 60 * 60 * 1000),
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
      getAsyncTasks(ownerCtx),
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

    const firstPage = await getAsyncTasks(ownerCtx)
    expect(firstPage).toHaveLength(20)
    expect(firstPage.every((task) => task.readAt === null)).toBe(true)

    await acknowledgeAsyncTasks(
      { ids: firstPage.map((task) => task.id) },
      ownerCtx
    )
    const secondPage = await getAsyncTasks(ownerCtx)

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
    ownerCtx.redisExec = {
      mget: async (...keys: string[]) => keys.map(() => null),
    } as ContextWithUser['redisExec']

    const tasks = await getAsyncTasks(ownerCtx)

    expect(tasks).toContainEqual(
      expect.objectContaining({
        id: task.id,
        status: AsyncTaskStatus.FAILED,
        errorCode: COURSE_DUPLICATION_ERROR_CODES.failed,
      })
    )
  })

  it('reconciles an older active task hidden beyond the display limit', async () => {
    const staleTask = await prisma.asyncTask.create({
      data: {
        kind: AsyncTaskKind.COURSE_DUPLICATION,
        status: AsyncTaskStatus.RUNNING,
        subjectName: 'Hidden missing duplication',
        ownerId,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 76 * 60 * 1000),
      },
    })
    await prisma.asyncTask.createMany({
      data: Array.from({ length: 50 }, (_, index) => ({
        kind: AsyncTaskKind.COURSE_DUPLICATION,
        status: AsyncTaskStatus.QUEUED,
        subjectName: `Newer duplication ${index}`,
        ownerId,
        createdAt: new Date(Date.now() - index * 1000),
      })),
    })
    ownerCtx.redisExec = {
      mget: async (...keys: string[]) =>
        keys.map((key) => (key.includes(staleTask.id) ? null : 'present')),
    } as ContextWithUser['redisExec']

    const tasks = await getAsyncTasks(ownerCtx)

    expect(tasks).toContainEqual(
      expect.objectContaining({
        id: staleTask.id,
        status: AsyncTaskStatus.FAILED,
        errorCode: COURSE_DUPLICATION_ERROR_CODES.failed,
      })
    )
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
      source: `query { asyncTaskAttentionCount asyncTasks { id subjectName } }`,
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
