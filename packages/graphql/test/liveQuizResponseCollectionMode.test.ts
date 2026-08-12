import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  LiveQuizResponseCollectionMode,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'events'
import { v4 as uuid } from 'uuid'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { manipulateLiveQuiz } from '../src/services/liveQuizzes.js'
import {
  initializePrisma,
  seedCourse,
  seedLiveQuiz,
  testCleanup,
  testInitialization,
} from './helpers.js'

describe('Live quiz response collection mode', () => {
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

  function liveQuizArgs() {
    return {
      name: uuid(),
      displayName: uuid(),
      blocks: [],
      multiplier: 1,
      isGamificationEnabled: false,
      isPinProtected: false,
      isConfusionFeedbackEnabled: false,
      isLiveQAEnabled: false,
      isModerationEnabled: false,
      courseId: null,
    }
  }

  it('defaults new live quizzes to aggregated anonymous responses', async () => {
    const liveQuiz = await manipulateLiveQuiz(liveQuizArgs(), userOneCtx)
    const stored = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: liveQuiz.id },
    })

    expect(stored.responseCollectionMode).toBe(
      LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS
    )
    expect(stored.exportSalt).toBeNull()
  })

  it('installs the respondent identity constraints and uniqueness index', async () => {
    const constraints = await prisma.$queryRaw<
      { name: string; definition: string }[]
    >`
      SELECT conname::text AS "name", pg_get_constraintdef(oid) AS "definition"
      FROM pg_constraint
      WHERE conname IN (
        'LiveQuizResponse_identity_check',
        'LiveQuizRespondent_secret_check'
      )
    `
    const definitions = Object.fromEntries(
      constraints.map(({ name, definition }) => [name, definition])
    )

    expect(definitions.LiveQuizResponse_identity_check).toContain(
      'num_nonnulls("participantId", "respondentId") = 1'
    )
    expect(definitions.LiveQuizRespondent_secret_check).toContain(
      `type <> 'ANONYMOUS_CORRELATED'`
    )
    expect(definitions.LiveQuizRespondent_secret_check).toContain(
      '"verificationSecretHash" IS NOT NULL'
    )

    const indexes = await prisma.$queryRaw<{ name: string }[]>`
      SELECT indexname::text AS "name"
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname =
          'LiveQuizResponse_instanceId_elementBlockExecution_responden_key'
    `

    expect(indexes).toEqual([
      {
        name: 'LiveQuizResponse_instanceId_elementBlockExecution_responden_key',
      },
    ])
  })

  it('creates and retains an export salt when correlated export is enabled', async () => {
    const liveQuiz = await manipulateLiveQuiz(
      {
        ...liveQuizArgs(),
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      },
      userOneCtx
    )
    const correlated = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: liveQuiz.id },
    })

    expect(correlated.responseCollectionMode).toBe(
      LiveQuizResponseCollectionMode.CORRELATED_EXPORT
    )
    expect(correlated.exportSalt).toMatch(/^[0-9a-f]{64}$/)

    await manipulateLiveQuiz(
      {
        ...liveQuizArgs(),
        id: liveQuiz.id,
        responseCollectionMode:
          LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS,
      },
      userOneCtx
    )
    const aggregated = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: liveQuiz.id },
    })

    expect(aggregated.responseCollectionMode).toBe(
      LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS
    )
    expect(aggregated.exportSalt).toBe(correlated.exportSalt)
  })

  it('keeps assessment live quizzes on identifiable assessment handling', async () => {
    const assessmentCourse = await seedCourse(
      { isAssessmentEnabled: true, isGamificationEnabled: false },
      userOneCtx
    )
    const liveQuiz = await manipulateLiveQuiz(
      {
        ...liveQuizArgs(),
        courseId: assessmentCourse.id,
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      },
      userOneCtx
    )
    const stored = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: liveQuiz.id },
    })

    expect(stored.isAssessmentEnabled).toBe(true)
    expect(stored.responseCollectionMode).toBe(
      LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS
    )
    expect(stored.exportSalt).toBeNull()
  })

  it('allows changing the mode while a live quiz is scheduled', async () => {
    const scheduledQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.SCHEDULED },
      userOneCtx
    )

    await manipulateLiveQuiz(
      {
        ...liveQuizArgs(),
        id: scheduledQuiz.id,
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      },
      userOneCtx
    )
    const stored = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: scheduledQuiz.id },
    })

    expect(stored.responseCollectionMode).toBe(
      LiveQuizResponseCollectionMode.CORRELATED_EXPORT
    )
  })

  it('rejects mode changes after a live quiz has ended', async () => {
    const endedQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.ENDED },
      userOneCtx
    )

    await expect(
      manipulateLiveQuiz(
        {
          ...liveQuizArgs(),
          id: endedQuiz.id,
          responseCollectionMode:
            LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: { code: 'LIVE_QUIZ_RESPONSE_MODE_LOCKED' },
    })
  })

  it('rechecks the mode lock when a quiz is published during an edit', async () => {
    const draftQuiz = await seedLiveQuiz(
      { elements: [], status: PublicationStatus.DRAFT },
      userOneCtx
    )
    const findUnique = prisma.liveQuiz.findUnique.bind(prisma.liveQuiz)
    const findUniqueDuringPublish = async (
      args: Parameters<typeof prisma.liveQuiz.findUnique>[0]
    ) => {
      const activity = await findUnique(args)
      await prisma.liveQuiz.update({
        where: { id: draftQuiz.id },
        data: { status: PublicationStatus.PUBLISHED },
      })
      return activity
    }
    const findUniqueSpy = vi
      .spyOn(prisma.liveQuiz, 'findUnique')
      .mockImplementationOnce(
        findUniqueDuringPublish as unknown as typeof prisma.liveQuiz.findUnique
      )

    try {
      await expect(
        manipulateLiveQuiz(
          {
            ...liveQuizArgs(),
            id: draftQuiz.id,
            responseCollectionMode:
              LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
          },
          userOneCtx
        )
      ).rejects.toMatchObject({
        extensions: { code: 'LIVE_QUIZ_RESPONSE_MODE_LOCKED' },
      })
    } finally {
      findUniqueSpy.mockRestore()
    }

    const stored = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: draftQuiz.id },
    })
    expect(stored.responseCollectionMode).toBe(
      LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS
    )
  })
})
