import { randomUUID } from 'node:crypto'
import type { EventType } from '@klicker-uzh/audit'
import { prisma, requireDisposableDatabase } from '@klicker-uzh/prisma'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  persistPreparedAssessmentAuditActivation,
  prepareAssessmentAuditActivation,
} from '../src/services/assessmentAuditActivation.js'
import { activateLiveQuizBlock } from '../src/services/liveQuizzes.js'

const unavailableMedia = {
  allowedHosts: ['test.blob.core.windows.net'],
  source: {
    async open() {
      throw new Error('Test assessment has no media to capture')
    },
  },
  store: {
    async createFromFile() {
      throw new Error('Test assessment has no media to store')
    },
  },
}

interface FakePipeline {
  hmset: (key: string, data: Record<string, unknown>) => FakePipeline
  exec: () => Promise<[Error | null, unknown][]>
}

describe('live quiz block activation recovery', () => {
  let userId: string
  let liveQuizId: string
  let blockId: number

  beforeEach(async () => {
    await requireDisposableDatabase(prisma)
    userId = randomUUID()
    liveQuizId = randomUUID()
    const identity = userId.replaceAll('-', '')
    await prisma.user.create({
      data: {
        id: userId,
        email: `recovery-${identity}@example.invalid`,
        shortname: `recovery-${identity}`,
      },
    })
  })

  afterEach(async () => {
    await requireDisposableDatabase(prisma)
    await prisma.assessmentAuditOutboxEvent.deleteMany({
      where: { liveQuizId },
    })
    await prisma.assessmentAuditScope.deleteMany({ where: { liveQuizId } })
    await prisma.assessmentAuditRolloutInventory.deleteMany({
      where: { liveQuizId },
    })
    await prisma.elementBlock.deleteMany({
      where: { liveQuizId },
    })
    await prisma.liveQuiz.deleteMany({ where: { id: liveQuizId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  async function createAssessmentQuizWithBlock(options: {
    isAssessmentEnabled: boolean
  }): Promise<void> {
    const identity = userId.replaceAll('-', '')
    const liveQuiz = await prisma.liveQuiz.create({
      data: {
        id: liveQuizId,
        name: `Recovery ${identity}`,
        displayName: `Recovery ${identity}`,
        ownerId: userId,
        isAssessmentEnabled: options.isAssessmentEnabled,
        ...(options.isAssessmentEnabled
          ? { pinCode: identity.slice(0, 6).toUpperCase() }
          : {}),
      },
    })
    const block = await prisma.elementBlock.create({
      data: {
        order: 0,
        execution: 0,
        status: 'SCHEDULED',
        liveQuizId,
      },
    })
    blockId = block.id
    void liveQuiz
    await recomputeDerivedPermissions({ liveQuizId }, prisma)
  }

  function failingRedisExec(onExec?: () => Promise<void> | void): FakePipeline {
    const pipeline: FakePipeline = {
      hmset() {
        return pipeline
      },
      async exec() {
        if (onExec) await onExec()
        return [[new Error('Injected seeding failure'), null]]
      },
    }
    return pipeline
  }

  function failingCtx(fake: FakePipeline): ContextWithUser {
    return {
      prisma,
      redisExec: { pipeline: () => fake },
      redisAssessmentExec: { pipeline: () => fake },
      user: { sub: userId, role: 'USER' },
      log: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
      },
      pubSub: {
        publish: () => undefined,
        asyncIterator: () => undefined,
      },
      emitter: { emit: () => undefined },
    } as unknown as ContextWithUser
  }

  async function prepareCoverage() {
    const capturedAt = new Date(Date.now() - 1_000)
    const prepared = await prepareAssessmentAuditActivation({
      client: prisma,
      liveQuizId,
      baselineKind: 'CREATION',
      media: unavailableMedia,
      capturedAt,
      now: () => new Date(capturedAt.getTime() + 500),
    })
    await persistPreparedAssessmentAuditActivation({
      client: prisma,
      prepared,
      actor: { kind: 'USER' as const, userId },
      correlationId: randomUUID(),
    })
  }

  async function activateWithFailingSeeding(
    onExec?: () => Promise<void> | void
  ): Promise<void> {
    const fake = failingRedisExec(onExec)
    const ctx = failingCtx(fake)
    await expect(
      activateLiveQuizBlock({ quizId: liveQuizId, blockId }, ctx)
    ).rejects.toThrow('Failed to initialize response cache for block')
  }

  async function blockState(): Promise<{
    status: string
    startedAt: Date | null
  } | null> {
    const block = await prisma.elementBlock.findUnique({
      where: { id: blockId },
      select: { status: true, startedAt: true },
    })
    return block ? { status: block.status, startedAt: block.startedAt } : null
  }

  async function outboxEventTypes(): Promise<Set<EventType>> {
    return new Set<EventType>(
      (
        await prisma.assessmentAuditOutboxEvent.findMany({
          where: { liveQuizId },
          select: { eventType: true },
        })
      ).map((event) => event.eventType as EventType)
    )
  }

  it('covered assessment: seeding failure compensates and emits typed revert evidence', async () => {
    await createAssessmentQuizWithBlock({ isAssessmentEnabled: true })
    await prepareCoverage()

    await activateWithFailingSeeding()

    const block = await blockState()
    expect(block?.status).toBe('SCHEDULED')
    expect(block?.startedAt).toBeNull()

    const quiz = await prisma.liveQuiz.findUnique({ where: { id: liveQuizId } })
    expect(quiz?.activeBlockId).toBeNull()

    const eventTypes = await outboxEventTypes()
    expect(eventTypes.has('ASSESSMENT_BLOCK_ACTIVATION_REVERTED')).toBe(true)
    expect(eventTypes.has('ASSESSMENT_BLOCK_ACTIVATED')).toBe(true)
  })

  it('missing audit coverage aborts compensation without unaudited revert', async () => {
    await createAssessmentQuizWithBlock({ isAssessmentEnabled: true })
    await prepareCoverage()

    // evidence becomes unwritable after staging (the covered scope record
    // is removed): the compensation must abort instead of committing an
    // unaudited business-state rollback
    await prisma.assessmentAuditScope.deleteMany({ where: { liveQuizId } })

    await activateWithFailingSeeding()

    // the block must not have been reverted to SCHEDULED without evidence
    const block = await blockState()
    expect(block?.status).toBe('ACTIVE')
    expect(block?.startedAt).not.toBeNull()

    const eventTypes = await outboxEventTypes()
    expect(eventTypes.has('ASSESSMENT_BLOCK_ACTIVATION_REVERTED')).toBe(false)
  })

  it('quiz-pointer CAS failure rolls back the block revert', async () => {
    await createAssessmentQuizWithBlock({ isAssessmentEnabled: false })

    // during seeding, a newer lifecycle operation disconnects the quiz
    // pointer only: the block CAS still matches, but the quiz CAS must fail
    // and roll the block revert back with it
    await activateWithFailingSeeding(async () => {
      await prisma.liveQuiz.update({
        where: { id: liveQuizId },
        data: { activeBlock: { disconnect: true } },
      })
    })

    // the whole compensation rolled back: the block is still ACTIVE from
    // the failed activation attempt (not silently reverted), and the quiz
    // pointer reflects the newer state
    const block = await blockState()
    expect(block?.status).toBe('ACTIVE')
    expect(block?.startedAt).not.toBeNull()

    const quiz = await prisma.liveQuiz.findUnique({ where: { id: liveQuizId } })
    expect(quiz?.activeBlockId).toBeNull()
  })

  it('a newer lifecycle state committed before compensation survives', async () => {
    await createAssessmentQuizWithBlock({ isAssessmentEnabled: false })

    // during seeding, a newer lifecycle operation closes the block and
    // clears the active-block pointer before compensation runs
    await activateWithFailingSeeding(async () => {
      await prisma.liveQuiz.update({
        where: { id: liveQuizId },
        data: { activeBlock: { disconnect: true } },
      })
      await prisma.elementBlock.update({
        where: { id: blockId },
        data: { status: 'EXECUTED', closedAt: new Date() },
      })
    })

    // the obsolete compensation must not have overwritten the newer state:
    // the block keeps its closed state and the pointer stays disconnected
    const block = await blockState()
    expect(block?.status).toBe('EXECUTED')
    expect(block?.startedAt).not.toBeNull()

    const quiz = await prisma.liveQuiz.findUnique({ where: { id: liveQuizId } })
    expect(quiz?.activeBlockId).toBeNull()
  })

  it('retry after successful compensation activates without duplicate evidence', async () => {
    await createAssessmentQuizWithBlock({ isAssessmentEnabled: true })
    await prepareCoverage()

    await activateWithFailingSeeding()

    const revertCount = await prisma.assessmentAuditOutboxEvent.count({
      where: { liveQuizId, eventType: 'ASSESSMENT_BLOCK_ACTIVATION_REVERTED' },
    })
    expect(revertCount).toBe(1)

    // a healthy retry activates the block normally (no failure injection)
    const healthy: FakePipeline = {
      hmset() {
        return healthy
      },
      async exec() {
        return []
      },
    }
    const ctx = failingCtx(healthy)
    await activateLiveQuizBlock({ quizId: liveQuizId, blockId }, ctx)

    const block = await blockState()
    expect(block?.status).toBe('ACTIVE')
    expect(block?.startedAt).not.toBeNull()

    const revertCountAfterRetry = await prisma.assessmentAuditOutboxEvent.count(
      {
        where: {
          liveQuizId,
          eventType: 'ASSESSMENT_BLOCK_ACTIVATION_REVERTED',
        },
      }
    )
    expect(revertCountAfterRetry).toBe(1)
  })
})
