import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getStudyStreakResponsesRemainingTodayForParticipations: vi.fn(),
  reconcileStudyStreak: vi.fn(),
}))

vi.mock('../src/services/studyStreak.js', async () => {
  const actual = await vi.importActual<
    typeof import('../src/services/studyStreak.js')
  >('../src/services/studyStreak.js')

  return {
    ...actual,
    ...mocks,
  }
})

import { getParticipations } from '../src/services/participants.js'

function participationRow(current = 0) {
  return {
    id: 1,
    participantId: 'participant-id',
    courseId: 'current-course',
    studyStreakCurrent: current,
  }
}

describe('getParticipations streak read path', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'))
    mocks.getStudyStreakResponsesRemainingTodayForParticipations.mockResolvedValue(
      new Map([[1, 2]])
    )
    mocks.reconcileStudyStreak.mockReset()
  })

  it('reconciles before loading rows and skips future or finalized courses', async () => {
    const current = participationRow()
    const events: string[] = []
    const participationFindMany = vi.fn().mockResolvedValue([
      {
        courseId: 'current-course',
        studyStreakLastProcessedDate: null,
        studyStreakTrackingStartedAt: new Date('2026-08-01T00:00:00.000Z'),
        course: {
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
        },
      },
      {
        courseId: 'future-course',
        studyStreakLastProcessedDate: null,
        studyStreakTrackingStartedAt: new Date('2026-08-01T00:00:00.000Z'),
        course: {
          startDate: new Date('2027-01-01T00:00:00.000Z'),
          endDate: new Date('2027-12-31T00:00:00.000Z'),
        },
      },
      {
        courseId: 'finalized-course',
        studyStreakLastProcessedDate: new Date('2026-01-31T00:00:00.000Z'),
        studyStreakTrackingStartedAt: new Date('2026-01-01T00:00:00.000Z'),
        course: {
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-01-31T00:00:00.000Z'),
        },
      },
      {
        courseId: 'ended-untracked-course',
        studyStreakLastProcessedDate: null,
        studyStreakTrackingStartedAt: null,
        course: {
          startDate: new Date('2026-01-01T00:00:00.000Z'),
          endDate: new Date('2026-01-31T00:00:00.000Z'),
        },
      },
    ])
    mocks.reconcileStudyStreak.mockImplementation(
      async (_deps, { courseId }: { courseId: string }) => {
        events.push(`reconcile:${courseId}`)
        current.studyStreakCurrent = 1
      }
    )
    const participantFindUnique = vi.fn().mockImplementation(async () => {
      events.push('load')
      return { participations: [current] }
    })

    const result = await getParticipations({}, {
      user: { sub: 'participant-id' },
      prisma: {
        participation: { findMany: participationFindMany },
        participant: { findUnique: participantFindUnique },
      },
    } as never)

    expect(mocks.reconcileStudyStreak).toHaveBeenCalledTimes(1)
    expect(mocks.reconcileStudyStreak).toHaveBeenCalledWith(expect.anything(), {
      courseId: 'current-course',
      participantId: 'participant-id',
    })
    expect(events).toEqual(['reconcile:current-course', 'load'])
    expect(result[0]).toMatchObject({
      studyStreakCurrent: 1,
      studyStreakResponsesRemainingToday: 2,
    })
  })
})
