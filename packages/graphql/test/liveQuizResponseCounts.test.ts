import type { EventEmitter } from 'node:events'
import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  ElementBlockStatus,
  ElementType,
  type PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import {
  getLiveQuizInstanceInfoKey,
  getLiveQuizLegacyResponseProcessedKey,
  getLiveQuizLegacyResponseReceivedKey,
  getLiveQuizResponseCountKey,
  getLiveQuizResponseReconciliationKey,
  getLiveQuizResponseReplayClaimKey,
  LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS,
} from '@klicker-uzh/util'
import axios from 'axios'
import { vi } from 'vitest'
import type { ContextWithUser } from '@/lib/context.js'
import {
  endLiveQuiz,
  getCockpitQuiz,
  removeCacheEntriesBlock,
} from '@/services/liveQuizzes.js'
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
      2
    )
    await userOneCtx.redisExec.hset(
      `lq:${quiz.id}:i:${secondInstance.id}:results`,
      'participants',
      2
    )
    await userOneCtx.redisExec.set(
      getLiveQuizResponseCountKey({
        liveQuizId: quiz.id,
        instanceId: firstInstance.id,
        status: 'received',
      }),
      '2'
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizLegacyResponseReceivedKey({
        liveQuizId: quiz.id,
        instanceId: firstInstance.id,
      }),
      'legacy-received'
    )
    await userOneCtx.redisExec.set(
      getLiveQuizResponseCountKey({
        liveQuizId: quiz.id,
        instanceId: firstInstance.id,
        status: 'processed',
      }),
      '1'
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizLegacyResponseReceivedKey({
        liveQuizId: quiz.id,
        instanceId: executedInstance.id,
      }),
      'executed-response'
    )
    await userOneCtx.redisExec.sadd(
      getLiveQuizLegacyResponseProcessedKey({
        liveQuizId: quiz.id,
        instanceId: executedInstance.id,
      }),
      'executed-response'
    )
    await userOneCtx.redisExec.set(
      getLiveQuizResponseCountKey({
        liveQuizId: quiz.id,
        instanceId: scheduledInstance.id,
        status: 'received',
      }),
      '1'
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
      numOfResponsesReceived: 3,
      numOfResponsesProcessed: 2,
    })
    expect(returnedActiveBlock?.elements[1]).toMatchObject({
      id: secondInstance.id,
      numOfResponsesReceived: 2,
      numOfResponsesProcessed: 2,
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

  it('hides processed counts while a response requires reconciliation', async () => {
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

    const block = await prisma.elementBlock.findFirstOrThrow({
      where: { liveQuizId: quiz.id },
      include: { elements: true },
    })
    const instance = block.elements[0]!
    await prisma.elementBlock.update({
      where: { id: block.id },
      data: {
        status: ElementBlockStatus.ACTIVE,
        activeInLiveQuiz: { connect: { id: quiz.id } },
      },
    })
    await userOneCtx.redisExec.hset(
      `lq:${quiz.id}:i:${instance.id}:results`,
      'participants',
      1
    )
    await userOneCtx.redisExec.hset(
      getLiveQuizResponseReconciliationKey({
        liveQuizId: quiz.id,
        instanceId: instance.id,
      }),
      'response-needing-reconciliation',
      JSON.stringify({ appliedCommandCount: 1 })
    )

    const cockpitQuiz = await getCockpitQuiz({ id: quiz.id }, userOneCtx)

    expect(cockpitQuiz?.blocks[0]?.elements[0]).toMatchObject({
      id: instance.id,
      numOfResponsesReceived: 1,
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

    // Fail only the response-count pipeline while leaving the participant
    // pipeline in the cockpit data path intact.
    const originalPipelineMethod = userOneCtx.redisExec.pipeline
    const originalPipeline = originalPipelineMethod.bind(userOneCtx.redisExec)
    let failNextPipeline = true
    userOneCtx.redisExec.pipeline = ((
      ...args: Parameters<typeof originalPipeline>
    ) => {
      const pipeline = originalPipeline(...args)
      if (failNextPipeline) {
        failNextPipeline = false
        pipeline.exec = () => Promise.reject(new Error('redis connection lost'))
      }
      return pipeline
    }) as typeof originalPipelineMethod

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
      userOneCtx.redisExec.pipeline = originalPipelineMethod
    }
  })

  it('does not extend retention when non-final block cleanup retries', async () => {
    const { AC1 } = await seedAnswerCollections(userOneCtx)
    const { SC, MC } = await seedElements(userOneCtx, AC1.id)
    const quiz = await seedLiveQuiz(
      {
        elements: [
          { id: SC.id, type: ElementType.SC },
          { id: MC.id, type: ElementType.MC },
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
    const block = blocks[0]!
    const instance = block.elements[0]!
    const retainedKeys = [
      getLiveQuizInstanceInfoKey({
        liveQuizId: quiz.id,
        instanceId: instance.id,
      }),
      `lq:${quiz.id}:i:${instance.id}:results`,
      `lq:${quiz.id}:b:${block.id}:lb`,
    ]
    await userOneCtx.redisExec.hset(retainedKeys[0]!, 'id', instance.id)
    await userOneCtx.redisExec.hset(retainedKeys[1]!, 'participants', 1)
    await userOneCtx.redisExec.hset(retainedKeys[2]!, 'participant-1', 1)
    await Promise.all(
      retainedKeys.map((key) => userOneCtx.redisExec.expire(key, 60))
    )
    const ttlBefore = await Promise.all(
      retainedKeys.map((key) => userOneCtx.redisExec.ttl(key))
    )

    await removeCacheEntriesBlock({
      liveQuizId: quiz.id,
      blockId: block.id,
      block,
      isLastBlock: false,
      redis: userOneCtx.redisExec,
    })
    await removeCacheEntriesBlock({
      liveQuizId: quiz.id,
      blockId: block.id,
      block,
      isLastBlock: false,
      redis: userOneCtx.redisExec,
    })

    const ttlAfter = await Promise.all(
      retainedKeys.map((key) => userOneCtx.redisExec.ttl(key))
    )
    ttlAfter.forEach((ttl, index) => {
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(ttlBefore[index]!)
    })
  })

  it('persists ENDED before retention and repairs retention on retry', async () => {
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
    })
    const instance = blocks[0]!.elements[0]!

    const originalMultiMethod = userOneCtx.redisExec.multi
    const originalMulti = originalMultiMethod.bind(userOneCtx.redisExec)
    let failNextMulti = true
    userOneCtx.redisExec.multi = ((
      ...args: Parameters<typeof originalMulti>
    ) => {
      const multi = originalMulti(...args)
      if (failNextMulti) {
        failNextMulti = false
        multi.exec = vi
          .fn()
          .mockResolvedValue([[new Error('retention failed'), null]])
      }
      return multi
    }) as typeof originalMultiMethod
    const originalTeamsWebhookUrl = process.env.TEAMS_WEBHOOK_URL
    process.env.TEAMS_WEBHOOK_URL = 'https://example.test/teams'
    const teamsPost = vi
      .spyOn(axios, 'post')
      .mockImplementation(async () => ({}) as never)

    try {
      try {
        await expect(endLiveQuiz({ id: quiz.id }, userOneCtx)).rejects.toThrow(
          'Failed to start instance-info retention'
        )
      } finally {
        userOneCtx.redisExec.multi = originalMultiMethod
      }

      const failedEnd = await prisma.liveQuiz.findUnique({
        where: { id: quiz.id },
        select: { status: true, finishedAt: true },
      })
      expect(failedEnd?.status).toBe(PublicationStatus.ENDED)
      expect(failedEnd?.finishedAt).not.toBeNull()

      const instanceInfoKey = getLiveQuizInstanceInfoKey({
        liveQuizId: quiz.id,
        instanceId: instance.id,
      })
      const trackingKeys = [
        getLiveQuizResponseCountKey({
          liveQuizId: quiz.id,
          instanceId: instance.id,
          status: 'received',
        }),
        getLiveQuizResponseCountKey({
          liveQuizId: quiz.id,
          instanceId: instance.id,
          status: 'processed',
        }),
        getLiveQuizResponseReplayClaimKey({
          liveQuizId: quiz.id,
          instanceId: instance.id,
        }),
        getLiveQuizResponseReconciliationKey({
          liveQuizId: quiz.id,
          instanceId: instance.id,
        }),
        getLiveQuizLegacyResponseReceivedKey({
          liveQuizId: quiz.id,
          instanceId: instance.id,
        }),
        getLiveQuizLegacyResponseProcessedKey({
          liveQuizId: quiz.id,
          instanceId: instance.id,
        }),
      ]

      await userOneCtx.redisExec.hset(
        instanceInfoKey,
        'id',
        String(instance.id)
      )
      await userOneCtx.redisExec.set(trackingKeys[0]!, '1')
      await userOneCtx.redisExec.set(trackingKeys[1]!, '1')
      await userOneCtx.redisExec.zadd(trackingKeys[2]!, Date.now(), 'message-1')
      await userOneCtx.redisExec.hset(
        trackingKeys[3]!,
        'reconciliation-message',
        JSON.stringify({ appliedCommandCount: 1 })
      )
      await userOneCtx.redisExec.sadd(trackingKeys[4]!, 'legacy-received')
      await userOneCtx.redisExec.sadd(trackingKeys[5]!, 'legacy-processed')

      const recoveredQuiz = await endLiveQuiz({ id: quiz.id }, userOneCtx)

      expect(recoveredQuiz?.status).toBe(PublicationStatus.ENDED)
      expect(recoveredQuiz?.finishedAt).toEqual(failedEnd?.finishedAt)
      for (const key of [instanceInfoKey, ...trackingKeys]) {
        const ttl = await userOneCtx.redisExec.ttl(key)
        expect(ttl).toBeGreaterThan(0)
        expect(ttl).toBeLessThanOrEqual(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS)
      }

      const retainedKeys = [instanceInfoKey, ...trackingKeys]
      await Promise.all(
        retainedKeys.map((key) => userOneCtx.redisExec.expire(key, 60))
      )
      const ttlBeforeRetry = await Promise.all(
        retainedKeys.map((key) => userOneCtx.redisExec.ttl(key))
      )

      await endLiveQuiz({ id: quiz.id }, userOneCtx)

      const ttlAfterRetry = await Promise.all(
        retainedKeys.map((key) => userOneCtx.redisExec.ttl(key))
      )
      ttlAfterRetry.forEach((ttl, index) => {
        expect(ttl).toBeGreaterThan(0)
        expect(ttl).toBeLessThanOrEqual(ttlBeforeRetry[index]!)
      })

      const notificationTexts = teamsPost.mock.calls.map(
        ([, body]) => (body as { text: string }).text
      )
      expect(
        notificationTexts.filter((text) => text.includes('] END Live quiz '))
      ).toHaveLength(1)
    } finally {
      teamsPost.mockRestore()
      if (originalTeamsWebhookUrl === undefined) {
        delete process.env.TEAMS_WEBHOOK_URL
      } else {
        process.env.TEAMS_WEBHOOK_URL = originalTeamsWebhookUrl
      }
    }
  })
})
