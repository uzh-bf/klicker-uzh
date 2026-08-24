import { prisma as prismaClient } from '@klicker-uzh/prisma'
import {
  CourseAuthType,
  ElementInstanceType,
  ElementStackType,
  ElementType,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import type {
  ElementData,
  ElementInstanceResults,
  SingleQuestionResponse,
} from '@klicker-uzh/types'
import { randomUUID } from 'node:crypto'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  applyQualifiedDate,
  applyMissedDate,
  FREEZE_BALANCE_MAX,
  FREEZE_EARN_THRESHOLD,
  getStudyStreakResponsesToday,
  QUALIFIED_RESPONSES_PER_DAY,
} from '../src/services/studyStreak.js'

const initialState = (): Parameters<typeof applyQualifiedDate>[0] => ({
  current: 0,
  longest: 0,
  freezeBalance: 2,
  qualifiedDaysSinceFreeze: 0,
  lastQualifiedDate: null,
  lastProcessedDate: null,
})

const activeParticipation = {
  id: 1,
  isActive: true,
  studyStreakTrackingStartedAt: new Date('2026-08-01T00:00:00.000Z'),
  course: {
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T00:00:00.000Z'),
    isGamificationEnabled: true,
    isAssessmentEnabled: false,
  },
}

afterEach(() => {
  vi.useRealTimers()
})

describe('constants', () => {
  it('uses the approved thresholds', () => {
    expect(QUALIFIED_RESPONSES_PER_DAY).toBe(5)
    expect(FREEZE_EARN_THRESHOLD).toBe(7)
    expect(FREEZE_BALANCE_MAX).toBe(3)
  })
})

describe('applyQualifiedDate', () => {
  it('starts a streak on the first weekday response date', () => {
    const result = applyQualifiedDate(initialState(), '2026-08-24') // Monday
    expect(result.current).toBe(1)
    expect(result.longest).toBe(1)
    expect(result.lastQualifiedDate).toBe('2026-08-24')
    expect(result.qualifiedDaysSinceFreeze).toBe(1)
  })

  it('ignores dates at or before the last processed date', () => {
    let state = applyQualifiedDate(initialState(), '2026-08-24')
    state = applyQualifiedDate(state, '2026-08-24') // same day again
    expect(state.current).toBe(1)
  })

  it('treats a Saturday as neutral (no advance, no break)', () => {
    let state = applyQualifiedDate(initialState(), '2026-08-24') // Monday
    state = applyQualifiedDate(state, '2026-08-29') // Saturday
    expect(state.current).toBe(1)
    expect(state.longest).toBe(1)
    expect(state.lastQualifiedDate).toBe('2026-08-24')
    expect(state.lastProcessedDate).toBe('2026-08-29')
    expect(state.freezeBalance).toBe(2)
  })

  it('advances across a weekend without consuming freezes', () => {
    let state = applyQualifiedDate(initialState(), '2026-08-28') // Friday
    state = applyQualifiedDate(state, '2026-08-31') // Monday after weekend
    expect(state.current).toBe(2)
    expect(state.freezeBalance).toBe(2)
  })

  it('breaks the streak after missed weekdays with zero balance', () => {
    const state0 = { ...initialState(), freezeBalance: 0 }
    let state = applyQualifiedDate(state0, '2026-08-24') // Monday
    state = applyQualifiedDate(state, '2026-08-27') // Thursday
    expect(state.current).toBe(1)
    expect(state.longest).toBe(1)
    expect(state.freezeBalance).toBe(0)
  })

  it('consumes one freeze for one missed weekday', () => {
    let state = applyQualifiedDate(initialState(), '2026-08-24') // Monday
    expect(state.freezeBalance).toBe(2)
    state = applyQualifiedDate(state, '2026-08-26') // Wednesday
    expect(state.current).toBe(2)
    expect(state.freezeBalance).toBe(1)
  })

  it('consumes at most one freeze for a two-weekday gap', () => {
    let state = applyQualifiedDate(initialState(), '2026-08-24') // Monday
    state = applyQualifiedDate(state, '2026-08-27') // Thursday
    expect(state.current).toBe(1)
    expect(state.freezeBalance).toBe(1)
  })

  it('resets when more weekdays are missed than freezes cover', () => {
    const lowBalance = { ...initialState(), freezeBalance: 1 }
    let state = applyQualifiedDate(lowBalance, '2026-08-24') // Monday
    state = applyQualifiedDate(state, '2026-08-28') // Friday
    expect(state.current).toBe(1)
    expect(state.freezeBalance).toBe(0)
  })

  it('earns a freeze after seven qualified days below max balance', () => {
    let state = initialState()
    const dates = [
      '2026-08-24',
      '2026-08-25',
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-31',
      '2026-09-01',
    ]
    for (const d of dates) {
      state = applyQualifiedDate(state, d)
    }
    expect(state.qualifiedDaysSinceFreeze).toBe(0)
    expect(state.freezeBalance).toBe(FREEZE_BALANCE_MAX)
  })

  it('does not exceed the maximum freeze balance', () => {
    const atMax = { ...initialState(), freezeBalance: FREEZE_BALANCE_MAX }
    const result = applyQualifiedDate(atMax, '2026-08-24')
    expect(result.freezeBalance).toBe(FREEZE_BALANCE_MAX)
  })
})

describe('applyMissedDate', () => {
  it('consumes freezes and resets the current streak without a later answer', () => {
    let state = applyQualifiedDate(initialState(), '2026-08-24') // Monday
    state = applyMissedDate(state, '2026-08-25')
    expect(state.current).toBe(1)
    expect(state.freezeBalance).toBe(1)

    state = applyMissedDate(state, '2026-08-26')
    expect(state.current).toBe(0)
    expect(state.freezeBalance).toBe(1)

    state = applyMissedDate(state, '2026-08-27')
    expect(state.current).toBe(0)
    expect(state.freezeBalance).toBe(1)
    expect(state.lastProcessedDate).toBe('2026-08-27')
  })

  it('keeps weekends neutral', () => {
    const state = applyMissedDate(
      { ...initialState(), current: 2, lastQualifiedDate: '2026-08-28' },
      '2026-08-29'
    )
    expect(state.current).toBe(2)
    expect(state.freezeBalance).toBe(2)
    expect(state.lastProcessedDate).toBe('2026-08-29')
  })
})

describe('getStudyStreakResponsesToday', () => {
  it('does not expose a daily goal on neutral weekends', async () => {
    vi.setSystemTime(new Date('2026-08-29T12:00:00.000Z')) // Saturday
    const count = vi.fn().mockResolvedValue(3)
    const prisma = {
      participation: {
        findUnique: vi.fn().mockResolvedValue(activeParticipation),
      },
      questionResponse: { count },
    } as never

    await expect(
      getStudyStreakResponsesToday(
        { prisma },
        { courseId: 'course-id', participantId: 'participant-id' }
      )
    ).resolves.toBeNull()
    expect(count).not.toHaveBeenCalled()
  })
})

describe.skipIf(!process.env.DATABASE_URL)(
  'getStudyStreakResponsesToday database behavior',
  () => {
    const ownerId = randomUUID()
    const participantId = randomUUID()
    const courseId = randomUUID()
    let prisma: typeof prismaClient
    let elementIds: number[] = []
    let participationId: number
    let practiceQuizId: string
    let fifthInstanceId: number

    beforeAll(async () => {
      prisma = prismaClient
      await prisma.$connect()

      await prisma.user.create({
        data: {
          id: ownerId,
          email: `${ownerId}@example.com`,
          shortname: ownerId,
        },
      })
      await prisma.participant.create({
        data: {
          id: participantId,
          username: participantId,
          password: 'test-password',
        },
      })
      await prisma.course.create({
        data: {
          id: courseId,
          name: courseId,
          displayName: courseId,
          startDate: new Date('2026-08-01T00:00:00.000Z'),
          endDate: new Date('2026-08-31T00:00:00.000Z'),
          groupDeadlineDate: new Date('2026-08-31T00:00:00.000Z'),
          authType: CourseAuthType.PIN,
          pinCode:
            (Number.parseInt(ownerId.replaceAll('-', '').slice(0, 8), 16) %
              900000) +
            100000,
          ownerId,
        },
      })
      const participation = await prisma.participation.create({
        data: {
          courseId,
          participantId,
          isActive: true,
          studyStreakTrackingStartedAt: new Date('2026-08-24T00:00:00.000Z'),
        },
      })
      participationId = participation.id

      const elements = await Promise.all(
        [
          ElementType.SC,
          ElementType.SC,
          ElementType.SC,
          ElementType.SC,
          ElementType.SC,
          ElementType.CONTENT,
        ].map((type, index) =>
          prisma.element.create({
            data: {
              type,
              name: `${courseId}-${index}`,
              content: 'test content',
              options: {},
              ownerId,
            },
          })
        )
      )
      elementIds = elements.map(({ id }) => id)

      const practiceQuiz = await prisma.practiceQuiz.create({
        data: {
          name: courseId,
          displayName: courseId,
          courseId,
          ownerId,
          stacks: {
            create: elements.map((element, index) => ({
              order: index,
              type: ElementStackType.PRACTICE_QUIZ,
              elements: {
                create: {
                  order: 0,
                  elementId: element.id,
                  type: ElementInstanceType.PRACTICE_QUIZ,
                  elementType: element.type,
                  options: {},
                  elementData: {} as ElementData,
                  results: {} as ElementInstanceResults,
                  anonymousResults: {} as ElementInstanceResults,
                  ownerId,
                },
              },
            })),
          },
        },
      })
      practiceQuizId = practiceQuiz.id
      const stacks = await prisma.elementStack.findMany({
        where: { practiceQuizId: practiceQuiz.id },
        include: { elements: true },
        orderBy: { order: 'asc' },
      })
      const instances = stacks.map((stack) => stack.elements[0]!)
      fifthInstanceId = instances[4]!.id
      const answeredAt = new Date('2026-08-24T12:00:00.000Z')
      const emptyResponse = {} as SingleQuestionResponse
      const responseData = instances.map((instance) => ({
        averageTimeSpent: 1,
        firstResponse: emptyResponse,
        firstResponseCorrectness: ResponseCorrectness.CORRECT,
        lastResponse: emptyResponse,
        lastResponseCorrectness: ResponseCorrectness.CORRECT,
        lastAnsweredAt: answeredAt,
        participantId,
        participationId: participation.id,
        elementInstanceId: instance.id,
        practiceQuizId: practiceQuiz.id,
        courseId,
      }))

      await prisma.questionResponse.createMany({
        data: responseData.slice(0, 4).concat(responseData[5]!),
      })
      await prisma.questionResponseDetail.createMany({
        data: [0, 0].map((_, index) => ({
          score: 0,
          timeSpent: 1,
          response: emptyResponse,
          participantId,
          participationId: participation.id,
          elementInstanceId: instances[0]!.id,
          practiceQuizId: practiceQuiz.id,
          createdAt: new Date(answeredAt.getTime() + index * 1000),
        })),
      })
    })

    afterAll(async () => {
      if (!prisma) return

      await prisma.questionResponseDetail.deleteMany({
        where: { participantId },
      })
      await prisma.questionResponse.deleteMany({ where: { participantId } })
      await prisma.course.deleteMany({ where: { id: courseId } })
      await prisma.element.deleteMany({ where: { id: { in: elementIds } } })
      await prisma.participant.deleteMany({ where: { id: participantId } })
      await prisma.user.deleteMany({ where: { id: ownerId } })
      await prisma.$disconnect()
    })

    it('counts aggregate rows, not repeated attempts or content responses', async () => {
      vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'))

      await expect(
        getStudyStreakResponsesToday({ prisma }, { courseId, participantId })
      ).resolves.toBe(4)

      await prisma.questionResponse.create({
        data: {
          averageTimeSpent: 1,
          firstResponse: {} as SingleQuestionResponse,
          firstResponseCorrectness: ResponseCorrectness.CORRECT,
          lastResponse: {} as SingleQuestionResponse,
          lastResponseCorrectness: ResponseCorrectness.CORRECT,
          lastAnsweredAt: new Date('2026-08-24T12:00:00.000Z'),
          participantId,
          participationId,
          elementInstanceId: fifthInstanceId,
          practiceQuizId,
          courseId,
        },
      })

      await expect(
        getStudyStreakResponsesToday({ prisma }, { courseId, participantId })
      ).resolves.toBe(5)
    })
  }
)
