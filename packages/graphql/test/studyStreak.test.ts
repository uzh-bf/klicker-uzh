import { afterEach, describe, expect, it, vi } from 'vitest'

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

  it('consumes two freezes for two missed weekdays', () => {
    let state = applyQualifiedDate(initialState(), '2026-08-24') // Monday
    state = applyQualifiedDate(state, '2026-08-27') // Thursday
    expect(state.current).toBe(2)
    expect(state.freezeBalance).toBe(0)
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
    expect(state.current).toBe(1)
    expect(state.freezeBalance).toBe(0)

    state = applyMissedDate(state, '2026-08-27')
    expect(state.current).toBe(0)
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
  it('uses distinct aggregate responses rather than response attempts', async () => {
    vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z')) // Monday
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
    ).resolves.toBe(3)

    expect(count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        participationId: activeParticipation.id,
        lastAnsweredAt: expect.any(Object),
      }),
    })
    expect(count.mock.calls.at(0)?.[0]?.where).not.toHaveProperty('createdAt')
  })

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
