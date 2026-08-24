import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  ElementBlockStatus,
  ElementType,
  PublicationStatus,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { getLiveQuizResponseTrackingKey } from '@klicker-uzh/util'
import type { EventEmitter } from 'node:events'
import type { ContextWithUser } from '../src/lib/context.js'
import { getCockpitQuiz } from '../src/services/liveQuizzes.js'
import {
  initializePrisma,
  seedAnswerCollections,
  seedElements,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('live quiz cockpit response counts', () => {
  let prisma: PrismaClient
  let hatchet: Hatchet
  let emitter: EventEmitter
  let userOneCtx: ContextWithUser
  let liveQuizId: string | undefined

  beforeAll(async () => {
    const initialized = await initializePrisma()
    prisma = initialized.prisma
    hatchet = initialized.hatchet
    emitter = initialized.emitter
  })

  beforeEach(async () => {
    const initialized = await testInitialization(prisma, hatchet, emitter)
    userOneCtx = initialized.userOneCtx
    liveQuizId = undefined
  })

  afterEach(async () => {
    if (liveQuizId) {
      const keys = await userOneCtx.redisExec.keys(`lq:${liveQuizId}:*`)
      if (keys.length > 0) {
        await userOneCtx.redisExec.del(...keys)
      }
    }
    await testCleanup(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('returns independent counts for started elements and null for scheduled elements', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SC, MC, NR, FT } = await seedElements(userOneCtx, AC1.id)
    const quiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: MC.id, type: ElementType.MC },
          { id: NR.id, type: ElementType.NUMERICAL },
          { id: FT.id, type: ElementType.FREE_TEXT },
        ],
        status: PublicationStatus.PUBLISHED,
      },
      userOneCtx
    )
    liveQuizId = quiz.id

    const blocks = await prisma.elementBlock.findMany({
      where: { liveQuizId: quiz.id },
      include: { elements: true },
      orderBy: { order: 'asc' },
    })
    const activeBlock = blocks[0]!
    const mergedBlock = blocks[1]!
    const executedBlock = blocks[2]!
    const scheduledBlock = blocks[3]!
    const firstInstance = activeBlock.elements[0]!
    const secondInstance = mergedBlock.elements[0]!
    const executedInstance = executedBlock.elements[0]!
    const scheduledInstance = scheduledBlock.elements[0]!

    await prisma.elementInstance.update({
      where: { id: secondInstance.id },
      data: {
        elementBlock: { connect: { id: activeBlock.id } },
        order: 1,
      },
    })
    await prisma.elementBlock.delete({ where: { id: mergedBlock.id } })
    await prisma.elementBlock.update({
      where: { id: activeBlock.id },
      data: {
        status: ElementBlockStatus.ACTIVE,
        activeInLiveQuiz: { connect: { id: quiz.id } },
      },
    })
    await prisma.elementBlock.update({
      where: { id: executedBlock.id },
      data: { status: ElementBlockStatus.EXECUTED },
    })

    await userOneCtx.redisExec.hset(
      `lq:${quiz.id}:i:${firstInstance.id}:results`,
      'participants',
      1
    )
    await userOneCtx.redisExec.hset(
      `lq:${quiz.id}:i:${secondInstance.id}:results`,
      'participants',
      0
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizResponseTrackingKey({
        liveQuizId: quiz.id,
        instanceId: firstInstance.id,
        status: 'received',
      }),
      'received-1',
      'received-2'
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizResponseTrackingKey({
        liveQuizId: quiz.id,
        instanceId: firstInstance.id,
        status: 'processed',
      }),
      'received-1'
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizResponseTrackingKey({
        liveQuizId: quiz.id,
        instanceId: executedInstance.id,
        status: 'received',
      }),
      'executed-response'
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizResponseTrackingKey({
        liveQuizId: quiz.id,
        instanceId: executedInstance.id,
        status: 'processed',
      }),
      'executed-response'
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizResponseTrackingKey({
        liveQuizId: quiz.id,
        instanceId: scheduledInstance.id,
        status: 'received',
      }),
      'scheduled-response'
    )

    const cockpitQuiz = await getCockpitQuiz({ id: quiz.id }, userOneCtx)
    const returnedActiveBlock = cockpitQuiz?.blocks.find(
      (block) => block.id === activeBlock.id
    )
    const returnedScheduledBlock = cockpitQuiz?.blocks.find(
      (block) => block.id === scheduledBlock.id
    )
    const returnedExecutedBlock = cockpitQuiz?.blocks.find(
      (block) => block.id === executedBlock.id
    )

    expect(returnedActiveBlock?.elements[0]).toMatchObject({
      id: firstInstance.id,
      numOfResponsesReceived: 2,
      numOfResponsesProcessed: 1,
    })
    expect(returnedActiveBlock?.elements[1]).toMatchObject({
      id: secondInstance.id,
      numOfResponsesReceived: 0,
      numOfResponsesProcessed: 0,
    })
    expect(returnedExecutedBlock?.elements[0]).toMatchObject({
      id: executedInstance.id,
      numOfResponsesReceived: 1,
      numOfResponsesProcessed: 1,
    })
    expect(returnedScheduledBlock?.elements[0]).toMatchObject({
      id: scheduledInstance.id,
      numOfResponsesReceived: null,
      numOfResponsesProcessed: null,
    })
  })

  it('degrades to null counts instead of failing when the count pipeline errors', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SC } = await seedElements(userOneCtx, AC1.id)
    const quiz = await seedLiveQuiz(
      {
        elements: [{ id: SC.id, type: ElementType.SC }],
        status: PublicationStatus.PUBLISHED,
      },
      userOneCtx
    )
    liveQuizId = quiz.id

    const blocks = await prisma.elementBlock.findMany({
      where: { liveQuizId: quiz.id },
      include: { elements: true },
      orderBy: { order: 'asc' },
    })
    const activeBlock = blocks[0]!
    await prisma.elementBlock.update({
      where: { id: activeBlock.id },
      data: {
        status: ElementBlockStatus.ACTIVE,
        activeInLiveQuiz: { connect: { id: quiz.id } },
      },
    })

    // force every SCARD in the count pipeline to fail while the rest of the
    // cockpit data path stays intact
    const originalScard = userOneCtx.redisExec.scard.bind(
      userOneCtx.redisExec
    )
    userOneCtx.redisExec.scard = () =>
      Promise.reject(new Error('redis connection lost'))

    try {
      const cockpitQuiz = await getCockpitQuiz({ id: quiz.id }, userOneCtx)

      expect(cockpitQuiz).not.toBeNull()
      expect(cockpitQuiz!.id).toBe(quiz.id)
      for (const block of cockpitQuiz!.blocks) {
        for (const element of block.elements) {
          expect(element.numOfResponsesReceived).toBeNull()
          expect(element.numOfResponsesProcessed).toBeNull()
        }
      }
    } finally {
      userOneCtx.redisExec.scard = originalScard
    }
  })
})
