import {
  ElementBlockStatus,
  ElementInstanceType,
  ElementType,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

function createContext({
  prisma,
  req,
  res = { clearCookie: vi.fn(), cookie: vi.fn() },
  user,
}: {
  prisma?: TRPCContext['prisma']
  req?: TRPCContext['req']
  res?: {
    clearCookie: ReturnType<typeof vi.fn>
    cookie: ReturnType<typeof vi.fn>
  }
  user?: TRPCContext['user']
} = {}): TRPCContext {
  return {
    prisma,
    req,
    res,
    user,
  }
}

function createPrisma(liveQuiz: unknown) {
  return {
    liveQuiz: {
      findUnique: vi.fn().mockResolvedValue(liveQuiz),
    },
  } as unknown as TRPCContext['prisma']
}

function createChoiceElement(id: number) {
  return {
    id,
    type: ElementInstanceType.LIVE_QUIZ,
    elementType: ElementType.SC,
    elementData: {
      id: `choice-${id}`,
      elementId: 100 + id,
      name: 'Choice',
      type: ElementType.SC,
      content: 'Choice content',
      explanation: 'Choice explanation',
      basePoints: true,
      pointsMultiplier: 1,
      options: {
        hasSampleSolution: true,
        displayMode: 'LIST',
        choices: [
          {
            ix: 0,
            value: 'A',
            correct: true,
            feedback: 'Correct feedback',
          },
        ],
      },
    },
  }
}

function createBlock({
  elements,
  id,
  status,
  timeLimit = 60,
}: {
  elements: ReturnType<typeof createChoiceElement>[]
  id: number
  status: ElementBlockStatus
  timeLimit?: number
}) {
  return {
    id,
    status,
    expiresAt: null,
    timeLimit,
    randomSelection: null,
    execution: 1,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    elements,
  }
}

describe('participant live quiz session routers', () => {
  afterEach(() => {
    vi.clearAllMocks()
    delete process.env.COOKIE_DOMAIN
  })

  test('sets the live quiz pin cookie for a valid published quiz pin', async () => {
    process.env.COOKIE_DOMAIN = 'klicker.localhost'
    const prisma = createPrisma({
      id: 'quiz-1',
      status: PublicationStatus.PUBLISHED,
      pinCode: 'ABC123',
    })
    const res = { clearCookie: vi.fn(), cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.setLiveQuizPin({
        liveQuizId: 'quiz-1',
        pin: 'ABC123',
      })
    ).resolves.toBe(true)

    expect(prisma?.liveQuiz.findUnique).toHaveBeenCalledWith({
      where: { id: 'quiz-1' },
      select: { id: true, status: true, pinCode: true },
    })
    expect(res.clearCookie).not.toHaveBeenCalled()
    expect(res.cookie).toHaveBeenCalledWith(
      'live-quiz-pin-quiz-1',
      'ABC123',
      expect.objectContaining({
        domain: 'klicker.localhost',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24,
        path: '/',
        sameSite: 'lax',
      })
    )
  })

  test('clears the live quiz pin cookie and rejects an invalid pin', async () => {
    process.env.COOKIE_DOMAIN = 'klicker.localhost'
    const prisma = createPrisma({
      id: 'quiz-1',
      status: PublicationStatus.PUBLISHED,
      pinCode: 'ABC123',
    })
    const res = { clearCookie: vi.fn(), cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.setLiveQuizPin({
        liveQuizId: 'quiz-1',
        pin: 'WRONG',
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'LIVE_QUIZ_PIN_INVALID',
    })

    expect(res.clearCookie).toHaveBeenCalledWith('live-quiz-pin-quiz-1', {
      domain: 'klicker.localhost',
      path: '/',
    })
    expect(res.cookie).not.toHaveBeenCalled()
  })

  test('rejects unavailable live quiz pin submissions without setting cookies', async () => {
    const prisma = createPrisma({
      id: 'quiz-1',
      status: PublicationStatus.DRAFT,
      pinCode: 'ABC123',
    })
    const res = { clearCookie: vi.fn(), cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.setLiveQuizPin({
        liveQuizId: 'quiz-1',
        pin: 'ABC123',
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'LIVE_QUIZ_PIN_INVALID',
    })

    expect(res.clearCookie).not.toHaveBeenCalled()
    expect(res.cookie).not.toHaveBeenCalled()
  })

  test('returns running live quiz data with only executable student fields', async () => {
    const liveQuizFindUnique = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'quiz-1',
        status: PublicationStatus.PUBLISHED,
        isAssessmentEnabled: false,
        pinCode: 'ABC123',
      })
      .mockResolvedValueOnce({
        id: 'quiz-1',
        status: PublicationStatus.PUBLISHED,
        isLiveQAEnabled: true,
        isConfusionFeedbackEnabled: false,
        isModerationEnabled: true,
        isGamificationEnabled: true,
        isAssessmentEnabled: false,
        namespace: 'namespace',
        displayName: 'Live Quiz',
        description: 'Description',
        course: {
          id: 'course-1',
          displayName: 'Course 1',
          color: '#0028a5',
          isGamificationEnabled: true,
        },
        activeBlock: createBlock({
          id: 2,
          status: ElementBlockStatus.ACTIVE,
          elements: [createChoiceElement(21)],
        }),
        blocks: [
          createBlock({
            id: 1,
            status: ElementBlockStatus.EXECUTED,
            timeLimit: 30,
            elements: [createChoiceElement(11)],
          }),
          createBlock({
            id: 2,
            status: ElementBlockStatus.ACTIVE,
            elements: [createChoiceElement(21)],
          }),
        ],
      })
    const prisma = {
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({
        prisma,
        req: { cookies: { 'live-quiz-pin-quiz-1': 'ABC123' } },
      })
    )

    const result = await caller.participant.runningLiveQuiz({ id: 'quiz-1' })
    const liveQuiz = result.studentLiveQuiz
    const activeElementData = liveQuiz?.activeBlock?.elements[0]
      ?.elementData as { options: { choices: unknown[] } }
    const executedElementData = liveQuiz?.blocks[0]?.elements[0]
      ?.elementData as { options: { choices: unknown[] } }

    expect(liveQuiz).toMatchObject({
      id: 'quiz-1',
      displayName: 'Live Quiz',
      isLiveQAEnabled: true,
      isPartOfGamifiedCourse: true,
      beforeFirstBlock: false,
      course: {
        id: 'course-1',
        displayName: 'Course 1',
        color: '#0028a5',
      },
      activeBlock: {
        id: 2,
        elements: [
          {
            id: 21,
            elementType: ElementType.SC,
          },
        ],
      },
    })
    expect(activeElementData.options.choices).toEqual([{ ix: 0, value: 'A' }])
    expect(executedElementData.options.choices).toEqual([{ ix: 0, value: 'A' }])
    expect(liveQuiz?.blocks[1]?.elements).toEqual([])
    expect(liveQuizFindUnique).toHaveBeenNthCalledWith(1, {
      where: { id: 'quiz-1' },
    })
    expect(liveQuizFindUnique).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'quiz-1' },
        include: expect.objectContaining({
          activeBlock: expect.any(Object),
          blocks: expect.any(Object),
          course: true,
        }),
      })
    )
  })

  test('returns null for unavailable running live quizzes', async () => {
    const prisma = createPrisma({
      id: 'quiz-1',
      status: PublicationStatus.DRAFT,
      isAssessmentEnabled: false,
      pinCode: null,
    })
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.runningLiveQuiz({ id: 'quiz-1' })
    ).resolves.toEqual({ studentLiveQuiz: null })
  })

  test('rejects missing and stale running live quiz pins like GraphQL', async () => {
    const liveQuizFindUnique = vi.fn().mockResolvedValue({
      id: 'quiz-1',
      status: PublicationStatus.PUBLISHED,
      isAssessmentEnabled: false,
      pinCode: 'ABC123',
    })
    const prisma = {
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const res = { clearCookie: vi.fn(), cookie: vi.fn() }
    const caller = appRouter.createCaller(createContext({ prisma, res }))

    await expect(
      caller.participant.runningLiveQuiz({ id: 'quiz-1' })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'LIVE_QUIZ_PIN_MISSING',
    })

    const stalePinCaller = appRouter.createCaller(
      createContext({
        prisma,
        req: { cookies: { 'live-quiz-pin-quiz-1': 'WRONG' } },
        res,
      })
    )

    await expect(
      stalePinCaller.participant.runningLiveQuiz({ id: 'quiz-1' })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'LIVE_QUIZ_PIN_INVALID',
    })

    expect(res.clearCookie).toHaveBeenCalledWith('live-quiz-pin-quiz-1', {
      domain: undefined,
      path: '/',
      secure: false,
      sameSite: 'lax',
    })
    expect(liveQuizFindUnique).toHaveBeenCalledTimes(2)
  })

  test('rejects unauthenticated assessment live quiz sessions', async () => {
    const prisma = createPrisma({
      id: 'quiz-1',
      status: PublicationStatus.PUBLISHED,
      isAssessmentEnabled: true,
      courseId: 'course-1',
      pinCode: null,
    })
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.runningLiveQuiz({ id: 'quiz-1' })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'UNAUTHORIZED_ASSESSMENT',
    })
    expect(prisma?.liveQuiz.findUnique).toHaveBeenCalledTimes(1)
  })

  test('rejects assessment live quiz sessions without course participation', async () => {
    const participationFindUnique = vi.fn().mockResolvedValue(null)
    const prisma = {
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'quiz-1',
          status: PublicationStatus.PUBLISHED,
          isAssessmentEnabled: true,
          courseId: 'course-1',
          pinCode: null,
        }),
      },
      participation: {
        findUnique: participationFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({
        prisma,
        user: {
          sub: 'participant-1',
          role: UserRole.PARTICIPANT,
          scope: UserLoginScope.EDUID,
        },
      })
    )

    await expect(
      caller.participant.runningLiveQuiz({ id: 'quiz-1' })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'MISSING_ASSESSMENT_COURSE_PARTICIPATION',
    })
    expect(participationFindUnique).toHaveBeenCalledWith({
      where: {
        courseId_participantId: {
          courseId: 'course-1',
          participantId: 'participant-1',
        },
      },
    })
  })
})
