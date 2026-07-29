import { describe, expect, it } from 'vitest'
import { isActivityEligibleForLearningAnalytics } from '../src/learningAnalytics.js'

describe('learning analytics eligibility', () => {
  const currentDisclosureVersion = '2026-07-29'
  const includedFrom = new Date('2026-07-29T08:00:00.000Z')
  const eligibleInput: Parameters<
    typeof isActivityEligibleForLearningAnalytics
  >[0] = {
    isCourseEnabled: true,
    participationStatus: 'INCLUDED',
    acknowledgedDisclosureVersion: currentDisclosureVersion,
    currentDisclosureVersion,
    includedFrom,
    activityAt: includedFrom,
  }

  it('includes an activity when every eligibility condition is met', () => {
    expect(isActivityEligibleForLearningAnalytics(eligibleInput)).toBe(true)
  })

  const cases: Array<{
    name: string
    input: Parameters<typeof isActivityEligibleForLearningAnalytics>[0]
    expected: boolean
  }> = [
    {
      name: 'includes activity after the inclusion boundary',
      input: {
        ...eligibleInput,
        activityAt: new Date('2026-07-29T08:00:01.000Z'),
      },
      expected: true,
    },
    {
      name: 'excludes activity when the course has disabled analytics',
      input: { ...eligibleInput, isCourseEnabled: false },
      expected: false,
    },
    {
      name: 'excludes an undecided participation',
      input: { ...eligibleInput, participationStatus: 'UNDECIDED' },
      expected: false,
    },
    {
      name: 'excludes an opted-out participation',
      input: { ...eligibleInput, participationStatus: 'EXCLUDED' },
      expected: false,
    },
    {
      name: 'excludes activity without an acknowledged disclosure',
      input: { ...eligibleInput, acknowledgedDisclosureVersion: null },
      expected: false,
    },
    {
      name: 'excludes activity acknowledged under an outdated disclosure',
      input: {
        ...eligibleInput,
        acknowledgedDisclosureVersion: '2026-07-23',
      },
      expected: false,
    },
    {
      name: 'excludes activity without an inclusion boundary',
      input: { ...eligibleInput, includedFrom: null },
      expected: false,
    },
    {
      name: 'excludes activity before the inclusion boundary',
      input: {
        ...eligibleInput,
        activityAt: new Date('2026-07-29T07:59:59.999Z'),
      },
      expected: false,
    },
    {
      name: 'keeps the disabled interval excluded after re-inclusion',
      input: {
        ...eligibleInput,
        includedFrom: new Date('2026-07-29T10:00:00.000Z'),
        activityAt: new Date('2026-07-29T09:00:00.000Z'),
      },
      expected: false,
    },
    {
      name: 'includes new activity after re-inclusion',
      input: {
        ...eligibleInput,
        includedFrom: new Date('2026-07-29T10:00:00.000Z'),
        activityAt: new Date('2026-07-29T10:00:00.001Z'),
      },
      expected: true,
    },
  ]

  it.each(cases)('$name', ({ input, expected }) => {
    expect(isActivityEligibleForLearningAnalytics(input)).toBe(expected)
  })
})
