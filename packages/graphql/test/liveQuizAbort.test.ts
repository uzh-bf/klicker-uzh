import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  ElementType,
  LiveQuizRespondentType,
  LiveQuizResponseCollectionMode,
  PrismaClient,
  PublicationStatus,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import { v4 as uuid } from 'uuid'
import type { ContextWithUser } from '../src/lib/context.js'
import { cancelLiveQuiz } from '../src/services/liveQuizzes.js'
import {
  initializePrisma,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Live quiz abort cleanup', () => {
  let prisma: PrismaClient
  let emitter: EventEmitter
  let hatchet: Hatchet
  let userOneCtx: ContextWithUser

  beforeAll(async () => {
    process.env.APP_SECRET = process.env.APP_SECRET ?? 'test-app-secret'
    process.env.APP_ORIGIN_API =
      process.env.APP_ORIGIN_API ?? 'https://api.klicker.test'

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
  it('removes the temporary correlated dataset when a published quiz is aborted', async () => {
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
        status: PublicationStatus.PUBLISHED,
      },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: {
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
        exportSalt: 'test-export-salt',
        startedAt: new Date(),
      },
    })
    const instance = await prisma.elementInstance.findFirstOrThrow({
      where: { elementBlock: { liveQuizId: liveQuiz.id } },
    })
    await prisma.elementInstance.update({
      where: { id: instance.id },
      data: {
        elementData: { type: ElementType.CONTENT, options: {} } as any,
        results: { total: 0 },
        anonymousResults: { total: 0 },
      },
    })
    const respondent = await prisma.liveQuizRespondent.create({
      data: {
        liveQuizId: liveQuiz.id,
        type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
        verificationSecretHash: 'test-verification-secret-hash',
      },
    })
    await prisma.liveQuizResponse.create({
      data: {
        submittedAt: new Date(),
        response: { viewed: true },
        timeSpent: -1,
        correctness: ResponseCorrectness.CORRECT,
        basePoints: 0,
        correctnessPoints: 0,
        bonusPoints: 0,
        elementBlockExecution: 0,
        instanceId: instance.id,
        respondentId: respondent.id,
      },
    })
    await prisma.liveQuizResponseExportLabel.create({
      data: {
        liveQuizId: liveQuiz.id,
        identityHash: 'test-identity-hash',
        label: 1,
      },
    })
    await prisma.liveQuizPendingResponse.create({
      data: {
        id: uuid(),
        liveQuizId: liveQuiz.id,
        responseKey: 'test-response-key',
        settledAt: new Date(),
      },
    })

    let cachePattern: string | undefined
    const redis = {
      eval: async (script: string, numberOfKeys: number, pattern: string) => {
        expect(script).toContain("redis.call('UNLINK', unpack(keys))")
        expect(numberOfKeys).toBe(0)
        cachePattern = pattern
        return 0
      },
    }
    await cancelLiveQuiz({ id: liveQuiz.id }, {
      ...userOneCtx,
      prisma,
      redisExec: redis,
      redisAssessmentExec: redis,
    } as any)

    await expect(
      prisma.liveQuiz.findUniqueOrThrow({ where: { id: liveQuiz.id } })
    ).resolves.toMatchObject({
      status: PublicationStatus.DRAFT,
      startedAt: null,
    })
    await expect(
      prisma.liveQuizResponse.count({
        where: { instanceId: instance.id },
      })
    ).resolves.toBe(0)
    await expect(
      prisma.liveQuizRespondent.count({
        where: { liveQuizId: liveQuiz.id },
      })
    ).resolves.toBe(0)
    await expect(
      prisma.liveQuizResponseExportLabel.count({
        where: { liveQuizId: liveQuiz.id },
      })
    ).resolves.toBe(0)
    await expect(
      prisma.liveQuizPendingResponse.count({
        where: { liveQuizId: liveQuiz.id },
      })
    ).resolves.toBe(0)
    expect(cachePattern).toBe(`lq:${liveQuiz.id}:*`)
  })
})
