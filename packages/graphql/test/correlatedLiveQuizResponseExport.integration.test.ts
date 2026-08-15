import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  ElementBlockStatus,
  ElementType,
  LiveQuizResponseCollectionMode,
  type PrismaClient,
  PublicationStatus,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import { v4 as uuid } from 'uuid'
import type { ContextWithUser } from '../src/lib/context.js'
import { getCorrelatedLiveQuizResponseExport } from '../src/services/correlatedLiveQuizResponseExport.js'
import {
  initializePrisma,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('correlated live-quiz response export integration', () => {
  let prisma: PrismaClient
  let emitter: EventEmitter
  let hatchet: Hatchet
  let userOneCtx: ContextWithUser

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    emitter = initialized.emitter
    hatchet = initialized.hatchet
    await testCleanup(prisma)
  }, 60000)

  afterAll(async () => {
    await testCleanup(prisma)
    await prisma.$disconnect()
  }, 60000)

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
  }, 30000)

  afterEach(async () => await testCleanup(prisma), 60000)

  it('exports only the current publication generation', async () => {
    const element = await prisma.element.create({
      data: {
        name: uuid(),
        content: uuid(),
        type: ElementType.CONTENT,
        options: {},
        ownerId: userOneCtx.user.sub,
      },
    })
    const liveQuiz = await seedLiveQuiz(
      {
        elements: [{ id: element.id, type: ElementType.CONTENT }],
        status: PublicationStatus.ENDED,
      },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: {
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
        publicationGeneration: 5,
        finishedAt: new Date('2026-08-15T18:00:00.000Z'),
      },
    })
    const block = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: liveQuiz.id },
    })
    await prisma.elementBlock.update({
      where: { id: block.id },
      data: { status: ElementBlockStatus.EXECUTED },
    })
    const instance = await prisma.elementInstance.findFirstOrThrow({
      where: { elementBlockId: block.id },
    })
    const finalizedAt = new Date('2026-08-15T19:00:00.000Z')
    const [currentRespondent, previousRespondent] = await Promise.all([
      prisma.liveQuizRespondent.create({
        data: {
          liveQuizId: liveQuiz.id,
          publicationGeneration: 5,
          type: null,
          exportLabel: 1,
          finalizedAt,
        },
      }),
      prisma.liveQuizRespondent.create({
        data: {
          liveQuizId: liveQuiz.id,
          publicationGeneration: 4,
          type: null,
          exportLabel: 9,
          finalizedAt,
        },
      }),
    ])
    await prisma.liveQuizResponse.createMany({
      data: [
        {
          submittedAt: finalizedAt,
          response: { value: 'current-answer' },
          timeSpent: 1,
          correctness: ResponseCorrectness.CORRECT,
          basePoints: 1,
          correctnessPoints: 1,
          bonusPoints: 0,
          elementBlockExecution: 0,
          instanceId: instance.id,
          respondentId: currentRespondent.id,
        },
        {
          submittedAt: finalizedAt,
          response: { value: 'previous-answer' },
          timeSpent: 1,
          correctness: ResponseCorrectness.CORRECT,
          basePoints: 1,
          correctnessPoints: 1,
          bonusPoints: 0,
          elementBlockExecution: 0,
          instanceId: instance.id,
          respondentId: previousRespondent.id,
        },
      ],
    })

    const result = await getCorrelatedLiveQuizResponseExport(
      { id: liveQuiz.id },
      userOneCtx
    )

    expect(result.content).toContain('current-answer')
    expect(result.content).not.toContain('previous-answer')
    expect(result.content).toMatch(/respondent_001/)
  })
})
