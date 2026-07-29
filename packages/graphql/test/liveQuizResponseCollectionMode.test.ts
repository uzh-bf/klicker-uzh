import type { Hatchet } from '@hatchet-dev/typescript-sdk/index.js'
import {
  CourseAuthType,
  LiveQuizRespondentType,
  LiveQuizResponseCollectionMode,
  Locale,
  PrismaClient,
  PublicationStatus,
} from '@klicker-uzh/prisma/client'
import { decodeJWT, recomputeDerivedPermissions } from '@klicker-uzh/util'
import { EventEmitter } from 'events'
import { v4 as uuid } from 'uuid'
import { vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import { loginTemporaryParticipant } from '../src/services/accounts.js'
import { applyActivityBatchOperations } from '../src/services/activities.js'
import { updateCourseSettings } from '../src/services/courses.js'
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
        'LiveQuiz_correlated_response_mode_check',
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
    expect(definitions.LiveQuiz_correlated_response_mode_check).toContain(
      `"responseCollectionMode" <> 'CORRELATED_EXPORT'`
    )
    expect(definitions.LiveQuiz_correlated_response_mode_check).toContain(
      'NOT "isGamificationEnabled"'
    )
    expect(definitions.LiveQuiz_correlated_response_mode_check).toContain(
      'NOT "isAssessmentEnabled"'
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

  it('rejects correlated exports when gamification is enabled directly', async () => {
    await expect(
      manipulateLiveQuiz(
        {
          ...liveQuizArgs(),
          isGamificationEnabled: true,
          responseCollectionMode:
            LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: {
        code: 'LIVE_QUIZ_CORRELATED_GAMIFICATION_CONFLICT',
      },
    })
  })

  it('rejects correlated exports inherited from a gamified course', async () => {
    const gamifiedCourse = await seedCourse(
      { isGamificationEnabled: true, isAssessmentEnabled: false },
      userOneCtx
    )

    await expect(
      manipulateLiveQuiz(
        {
          ...liveQuizArgs(),
          courseId: gamifiedCourse.id,
          responseCollectionMode:
            LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: {
        code: 'LIVE_QUIZ_CORRELATED_GAMIFICATION_CONFLICT',
      },
    })
  })

  it('rejects assigning a correlated quiz to a gamified course in a batch', async () => {
    const correlatedQuiz = await manipulateLiveQuiz(
      {
        ...liveQuizArgs(),
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      },
      userOneCtx
    )
    const gamifiedCourse = await seedCourse(
      { isGamificationEnabled: true, isAssessmentEnabled: false },
      userOneCtx
    )
    await recomputeDerivedPermissions({ courseId: gamifiedCourse.id }, prisma)

    await expect(
      applyActivityBatchOperations(
        {
          activityIds: [correlatedQuiz.id],
          courseId: gamifiedCourse.id,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: {
        code: 'LIVE_QUIZ_CORRELATED_GAMIFICATION_CONFLICT',
      },
    })
  })

  it('rejects enabling gamification on a course with a correlated quiz', async () => {
    const course = await seedCourse(
      { isGamificationEnabled: false, isAssessmentEnabled: false },
      userOneCtx
    )
    await manipulateLiveQuiz(
      {
        ...liveQuizArgs(),
        courseId: course.id,
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      },
      userOneCtx
    )

    await expect(
      updateCourseSettings(
        {
          id: course.id,
          language: Locale.en,
          isGamificationEnabled: true,
          isAssessmentEnabled: false,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: {
        code: 'LIVE_QUIZ_CORRELATED_GAMIFICATION_CONFLICT',
      },
    })
  })

  it('switches draft correlated quizzes to assessment handling with their course', async () => {
    const course = await seedCourse(
      { isGamificationEnabled: false, isAssessmentEnabled: false },
      userOneCtx
    )
    const liveQuiz = await manipulateLiveQuiz(
      {
        ...liveQuizArgs(),
        courseId: course.id,
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      },
      userOneCtx
    )
    await prisma.course.update({
      where: { id: course.id },
      data: { authType: CourseAuthType.SSO, pinCode: null },
    })

    await updateCourseSettings(
      {
        id: course.id,
        language: Locale.en,
        isGamificationEnabled: false,
        isAssessmentEnabled: true,
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
  })

  it('rejects assessment mode while a correlated live quiz is running', async () => {
    const course = await seedCourse(
      { isGamificationEnabled: false, isAssessmentEnabled: false },
      userOneCtx
    )
    const liveQuiz = await manipulateLiveQuiz(
      {
        ...liveQuizArgs(),
        courseId: course.id,
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: { status: PublicationStatus.PUBLISHED },
    })

    await expect(
      updateCourseSettings(
        {
          id: course.id,
          language: Locale.en,
          isGamificationEnabled: false,
          isAssessmentEnabled: true,
        },
        userOneCtx
      )
    ).rejects.toMatchObject({
      extensions: {
        code: 'LIVE_QUIZ_CORRELATED_ASSESSMENT_CONFLICT',
      },
    })
  })

  it('switches a correlated quiz to assessment handling in a batch', async () => {
    const correlatedQuiz = await manipulateLiveQuiz(
      {
        ...liveQuizArgs(),
        responseCollectionMode:
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
      },
      userOneCtx
    )
    const assessmentCourse = await seedCourse(
      { isGamificationEnabled: true, isAssessmentEnabled: true },
      userOneCtx
    )
    await recomputeDerivedPermissions({ courseId: assessmentCourse.id }, prisma)

    await expect(
      applyActivityBatchOperations(
        {
          activityIds: [correlatedQuiz.id],
          courseId: assessmentCourse.id,
        },
        userOneCtx
      )
    ).resolves.toBe(1)

    const stored = await prisma.liveQuiz.findUniqueOrThrow({
      where: { id: correlatedQuiz.id },
    })
    expect(stored.isAssessmentEnabled).toBe(true)
    expect(stored.responseCollectionMode).toBe(
      LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS
    )
  })

  it('assigns temporary pseudonyms the same quiz-scoped respondent identity', async () => {
    const liveQuiz = await manipulateLiveQuiz(
      {
        ...liveQuizArgs(),
        isGamificationEnabled: true,
      },
      userOneCtx
    )
    await prisma.liveQuiz.update({
      where: { id: liveQuiz.id },
      data: { status: PublicationStatus.PUBLISHED },
    })

    const setCookie = vi.fn()
    const token = await loginTemporaryParticipant(
      {
        liveQuizId: liveQuiz.id,
        pseudonym: `temporary-${uuid()}`,
      },
      {
        ...userOneCtx,
        res: { cookie: setCookie } as any,
      }
    )

    expect(token).not.toBeNull()
    const payload = decodeJWT(token!)
    expect(payload.scopeQuizId).toBe(liveQuiz.id)

    const [leaderboardEntry, respondent] = await Promise.all([
      prisma.temporaryLeaderboardEntry.findUnique({
        where: {
          id_quizId: {
            id: payload.sub,
            quizId: liveQuiz.id,
          },
        },
      }),
      prisma.liveQuizRespondent.findUnique({
        where: { id: payload.sub },
      }),
    ])

    expect(leaderboardEntry).not.toBeNull()
    expect(respondent).toMatchObject({
      id: payload.sub,
      liveQuizId: liveQuiz.id,
      type: LiveQuizRespondentType.TEMPORARY_PSEUDONYM,
    })
    expect(leaderboardEntry).toMatchObject({
      username: expect.stringMatching(/^temporary-/),
    })
    expect(setCookie).toHaveBeenCalledWith(
      'temporary_participant_token',
      token,
      expect.objectContaining({ maxAge: 1000 * 60 * 60 * 24 * 14 })
    )
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
