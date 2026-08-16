import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  ElementType,
  LiveQuizRespondentType,
  LiveQuizResponseCollectionMode,
  type PrismaClient,
  PublicationStatus,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import { v4 as uuid } from 'uuid'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  endLiveQuizAndFinalizeCorrelatedGeneration,
  finalizeCorrelatedLiveQuiz,
  reconcileCorrelatedLiveQuizFinalizations,
  reconcileExpiredCorrelatedLiveQuizResponses,
} from '../src/services/liveQuizResponseFinalization.js'
import {
  initializePrisma,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Live quiz correlated response finalization', () => {
  let prisma: PrismaClient
  let emitter: EventEmitter
  let hatchet: Hatchet
  let userOneCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    emitter = initialized.emitter
    hatchet = initialized.hatchet
  })

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
  })

  afterEach(async () => await testCleanup(prisma))

  it('waits for every generation-scoped receipt before finalization', async () => {
    const liveQuiz = await seedCorrelatedQuiz(prisma, userOneCtx)
    const respondent = await prisma.liveQuizRespondent.create({
      data: {
        liveQuizId: liveQuiz.id,
        publicationGeneration: 4,
        type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
        verificationSecretHash: 'legacy-secret-hash',
      },
    })
    await prisma.liveQuizRespondentBinding.create({
      data: {
        respondentId: respondent.id,
        liveQuizId: liveQuiz.id,
        publicationGeneration: 4,
        verificationSecretHash: 'binding-secret-hash',
        expiresAt: new Date('2026-08-16T00:00:00.000Z'),
      },
    })
    const pendingResponseKey = uuid()
    await prisma.liveQuizPendingResponse.create({
      data: {
        id: uuid(),
        liveQuizId: liveQuiz.id,
        publicationGeneration: 4,
        responseKey: pendingResponseKey,
        eventPayload: 'encrypted-payload',
      },
    })

    await expect(
      finalizeCorrelatedLiveQuiz({ prisma, liveQuizId: liveQuiz.id })
    ).resolves.toBe('pending')

    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({ exportSalt: 'test-export-salt' })
    await expect(
      prisma.liveQuizRespondentBinding.findUnique({
        where: { respondentId: respondent.id },
      })
    ).resolves.not.toBeNull()
    await expect(
      prisma.liveQuizPendingResponse.findUnique({
        where: { responseKey: pendingResponseKey },
      })
    ).resolves.toBeDefined()
  })

  it('assigns stable labels, removes transient identity data, and retains responses', async () => {
    const element = await prisma.element.create({
      data: {
        name: uuid(),
        content: uuid(),
        type: ElementType.CONTENT,
        options: {},
        ownerId: userOneCtx.user.sub,
      },
    })
    const liveQuiz = await seedCorrelatedQuiz(prisma, userOneCtx, [element.id])
    const now = new Date('2026-08-15T18:00:00.000Z')
    const respondents = await Promise.all(
      ['first', 'second'].map((name) =>
        prisma.liveQuizRespondent.create({
          data: {
            id: uuid(),
            liveQuizId: liveQuiz.id,
            publicationGeneration: 4,
            type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
            username: name,
            avatar: `${name}-avatar`,
            score: 12,
            verificationSecretHash: `${name}-legacy-secret`,
          },
        })
      )
    )
    const [firstRespondent] = respondents
    if (!firstRespondent) throw new Error('Expected a seeded respondent')
    await Promise.all(
      respondents.map((respondent, index) =>
        prisma.liveQuizRespondentBinding.create({
          data: {
            respondentId: respondent.id,
            liveQuizId: liveQuiz.id,
            publicationGeneration: 4,
            verificationSecretHash: `binding-secret-${index}`,
            expiresAt: new Date('2026-08-16T00:00:00.000Z'),
          },
        })
      )
    )
    const instance = await prisma.elementInstance.findFirstOrThrow({
      where: { elementBlock: { liveQuizId: liveQuiz.id } },
    })
    await prisma.liveQuizResponse.create({
      data: {
        submittedAt: now,
        response: { viewed: true },
        timeSpent: 1,
        correctness: ResponseCorrectness.CORRECT,
        basePoints: 1,
        correctnessPoints: 1,
        bonusPoints: 0,
        elementBlockExecution: 0,
        instanceId: instance.id,
        respondentId: firstRespondent.id,
      },
    })
    await prisma.liveQuizPendingResponse.create({
      data: {
        id: uuid(),
        liveQuizId: liveQuiz.id,
        publicationGeneration: 4,
        responseKey: uuid(),
        settledAt: now,
      },
    })

    const otherGenerationRespondent = await prisma.liveQuizRespondent.create({
      data: {
        id: uuid(),
        liveQuizId: liveQuiz.id,
        publicationGeneration: 5,
        type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
        verificationSecretHash: 'other-generation-legacy-secret',
      },
    })
    await prisma.liveQuizRespondentBinding.create({
      data: {
        respondentId: otherGenerationRespondent.id,
        liveQuizId: liveQuiz.id,
        publicationGeneration: 5,
        verificationSecretHash: 'other-generation-secret',
        expiresAt: new Date('2026-08-16T00:00:00.000Z'),
      },
    })
    await prisma.liveQuizPendingResponse.create({
      data: {
        id: uuid(),
        liveQuizId: liveQuiz.id,
        publicationGeneration: 5,
        responseKey: uuid(),
        settledAt: now,
      },
    })

    await expect(
      finalizeCorrelatedLiveQuiz({ prisma, liveQuizId: liveQuiz.id, now })
    ).resolves.toBe('finalized')

    const finalizedRespondents = await prisma.liveQuizRespondent.findMany({
      where: { liveQuizId: liveQuiz.id, publicationGeneration: 4 },
      orderBy: { exportLabel: 'asc' },
    })
    expect(finalizedRespondents).toHaveLength(2)
    expect(finalizedRespondents.map(({ exportLabel }) => exportLabel)).toEqual([
      1, 2,
    ])
    expect(
      finalizedRespondents.every(
        ({
          finalizedAt,
          type,
          username,
          avatar,
          score,
          verificationSecretHash,
        }) =>
          finalizedAt?.getTime() === now.getTime() &&
          type === null &&
          username === null &&
          avatar === null &&
          score === 0 &&
          verificationSecretHash === null
      )
    ).toBe(true)
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({ exportSalt: null })
    await expect(
      prisma.liveQuizRespondentBinding.count({
        where: { liveQuizId: liveQuiz.id, publicationGeneration: 4 },
      })
    ).resolves.toBe(0)
    await expect(
      prisma.liveQuizPendingResponse.count({
        where: { liveQuizId: liveQuiz.id, publicationGeneration: 4 },
      })
    ).resolves.toBe(0)
    await expect(
      prisma.liveQuizResponse.count({
        where: { respondentId: firstRespondent.id },
      })
    ).resolves.toBe(1)

    await expect(
      prisma.liveQuizRespondent.findUniqueOrThrow({
        where: { id: otherGenerationRespondent.id },
      })
    ).resolves.toMatchObject({ publicationGeneration: 5, finalizedAt: null })
    await expect(
      prisma.liveQuizRespondentBinding.count({
        where: { liveQuizId: liveQuiz.id, publicationGeneration: 5 },
      })
    ).resolves.toBe(1)
    await expect(
      prisma.liveQuizPendingResponse.count({
        where: { liveQuizId: liveQuiz.id, publicationGeneration: 5 },
      })
    ).resolves.toBe(1)

    await expect(
      finalizeCorrelatedLiveQuiz({ prisma, liveQuizId: liveQuiz.id, now })
    ).resolves.toBe('finalized')
  })

  it('ends a published correlated quiz and leaves incomplete settlement for reconciliation', async () => {
    const liveQuiz = await seedCorrelatedQuiz(
      prisma,
      userOneCtx,
      [],
      PublicationStatus.PUBLISHED
    )
    await prisma.liveQuizPendingResponse.create({
      data: {
        id: uuid(),
        liveQuizId: liveQuiz.id,
        publicationGeneration: 4,
        responseKey: uuid(),
      },
    })

    await expect(
      endLiveQuizAndFinalizeCorrelatedGeneration({
        prisma,
        liveQuizId: liveQuiz.id,
      })
    ).resolves.toMatchObject({ status: PublicationStatus.ENDED })
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({
      status: PublicationStatus.ENDED,
      exportSalt: 'test-export-salt',
    })
  })

  it('finalizes soft-deleted ended correlated quizzes through reconciliation', async () => {
    const liveQuiz = await seedCorrelatedQuiz(prisma, userOneCtx)
    const respondent = await prisma.liveQuizRespondent.create({
      data: {
        liveQuizId: liveQuiz.id,
        publicationGeneration: 4,
        type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
        verificationSecretHash: 'legacy-secret-hash',
      },
    })
    await prisma.liveQuizRespondentBinding.create({
      data: {
        respondentId: respondent.id,
        liveQuizId: liveQuiz.id,
        publicationGeneration: 4,
        verificationSecretHash: 'binding-secret-hash',
        expiresAt: new Date('2026-08-16T00:00:00.000Z'),
      },
    })
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: { isDeleted: true },
    })

    await expect(
      reconcileCorrelatedLiveQuizFinalizations({ prisma })
    ).resolves.toBe(1)

    await expect(
      prisma.liveQuizRespondentBinding.findUnique({
        where: { respondentId: respondent.id },
      })
    ).resolves.toBeNull()
    await expect(
      prisma.liveQuizRespondent.findUniqueOrThrow({
        where: { id: respondent.id },
      })
    ).resolves.toMatchObject({ exportLabel: 1 })
    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({ exportSalt: null })
  })

  it('expires finalized correlated datasets after the retention window', async () => {
    const element = await prisma.element.create({
      data: {
        name: uuid(),
        content: uuid(),
        type: ElementType.CONTENT,
        options: {},
        ownerId: userOneCtx.user.sub,
      },
    })
    const liveQuiz = await seedCorrelatedQuiz(prisma, userOneCtx, [element.id])
    const now = new Date('2026-08-16T00:00:00.000Z')
    const expiredAt = new Date(now.getTime() - (90 + 1) * 24 * 60 * 60 * 1000)
    const retainedAt = new Date(now.getTime() - (90 - 1) * 24 * 60 * 60 * 1000)
    const [expiredRespondent, retainedRespondent] = await Promise.all([
      prisma.liveQuizRespondent.create({
        data: {
          id: uuid(),
          liveQuizId: liveQuiz.id,
          publicationGeneration: 4,
          exportLabel: 1,
          finalizedAt: expiredAt,
        },
      }),
      prisma.liveQuizRespondent.create({
        data: {
          id: uuid(),
          liveQuizId: liveQuiz.id,
          publicationGeneration: 4,
          exportLabel: 2,
          finalizedAt: retainedAt,
        },
      }),
    ])
    const bindingBlockedRespondent = await prisma.liveQuizRespondent.create({
      data: {
        id: uuid(),
        liveQuizId: liveQuiz.id,
        publicationGeneration: 4,
        exportLabel: 3,
        finalizedAt: expiredAt,
      },
    })
    const pendingBlockedRespondent = await prisma.liveQuizRespondent.create({
      data: {
        id: uuid(),
        liveQuizId: liveQuiz.id,
        publicationGeneration: 5,
        exportLabel: 4,
        finalizedAt: expiredAt,
      },
    })
    await prisma.liveQuizRespondentBinding.create({
      data: {
        respondentId: bindingBlockedRespondent.id,
        liveQuizId: liveQuiz.id,
        publicationGeneration: 4,
        verificationSecretHash: uuid(),
        expiresAt: new Date('2026-08-17T00:00:00.000Z'),
      },
    })
    await prisma.liveQuizPendingResponse.create({
      data: {
        id: uuid(),
        liveQuizId: liveQuiz.id,
        publicationGeneration: 5,
        responseKey: uuid(),
      },
    })
    const instance = await prisma.elementInstance.findFirstOrThrow({
      where: { elementBlock: { liveQuizId: liveQuiz.id } },
    })
    await Promise.all(
      [expiredRespondent, retainedRespondent].map((respondent) =>
        prisma.liveQuizResponse.create({
          data: {
            submittedAt: expiredAt,
            response: { viewed: true },
            timeSpent: -1,
            correctness: ResponseCorrectness.CORRECT,
            basePoints: 1,
            correctnessPoints: 0,
            bonusPoints: 0,
            elementBlockExecution: 0,
            instanceId: instance.id,
            respondentId: respondent.id,
          },
        })
      )
    )

    await expect(
      reconcileExpiredCorrelatedLiveQuizResponses({
        prisma,
        now,
      })
    ).resolves.toBe(1)

    await expect(
      prisma.liveQuizRespondent.findUnique({
        where: { id: expiredRespondent.id },
      })
    ).resolves.toBeNull()
    await expect(
      prisma.liveQuizResponse.count({
        where: { respondentId: expiredRespondent.id },
      })
    ).resolves.toBe(0)
    await expect(
      prisma.liveQuizRespondent.findUnique({
        where: { id: retainedRespondent.id },
      })
    ).resolves.toMatchObject({ exportLabel: 2, finalizedAt: retainedAt })
    await expect(
      prisma.liveQuizResponse.count({
        where: { respondentId: retainedRespondent.id },
      })
    ).resolves.toBe(1)
    await expect(
      prisma.liveQuizRespondent.findMany({
        where: {
          id: {
            in: [bindingBlockedRespondent.id, pendingBlockedRespondent.id],
          },
        },
      })
    ).resolves.toHaveLength(2)
  })
})

async function seedCorrelatedQuiz(
  prisma: PrismaClient,
  ctx: ContextWithUser,
  elementIds: number[] = [],
  status: PublicationStatus = PublicationStatus.ENDED
) {
  const liveQuiz = await seedLiveQuiz(
    {
      elements: elementIds.map((id) => ({ id, type: ElementType.CONTENT })),
      status,
    },
    ctx
  )

  return prisma.liveQuiz.update({
    where: { id: liveQuiz.id },
    data: {
      responseCollectionMode: LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      publicationGeneration: 4,
      exportSalt: 'test-export-salt',
      finishedAt: new Date('2026-08-15T17:00:00.000Z'),
    },
  })
}
