import { describe, expect, it, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  getCourseActivityAnalytics,
  getCoursePerformanceAnalytics,
} from '../src/services/analytics.js'

const participantId = '00000000-0000-4000-8000-000000000001'
const initialTime = new Date('2026-08-26T18:00:00.000Z')
const nextTime = new Date('2026-08-26T18:01:00.000Z')

type ParticipantAnalyticsFilter = {
  participantId: { in: string[] }
}

type CourseFindUniqueArgs = {
  include: {
    participantCourseAnalytics?: { where: ParticipantAnalyticsFilter }
    participantPerformances?: { where: ParticipantAnalyticsFilter }
  }
}

describe('participant data-use API', () => {
  it('exposes six current-state fields and keeps them out of Participant', () => {
    const dataUseType = schema.getType('ParticipantDataUse')
    expect(dataUseType).toBeDefined()
    if (!dataUseType) return
    const dataUseFields = Object.keys(
      (dataUseType as { getFields: () => Record<string, unknown> }).getFields()
    ).sort()
    expect(dataUseFields).toEqual([
      'learningAnalyticsChoiceAt',
      'learningAnalyticsConsent',
      'learningAnalyticsDisclosureVersion',
      'researchConsent',
      'researchConsentChoiceAt',
      'researchConsentDisclosureVersion',
    ])

    const participantType = schema.getType('Participant')
    expect(participantType).toBeDefined()
    if (!participantType) return
    const participantFields = (
      participantType as { getFields: () => Record<string, unknown> }
    ).getFields()
    for (const field of [
      'researchConsent',
      'researchConsentChoiceAt',
      'researchConsentDisclosureVersion',
      'learningAnalyticsConsent',
      'learningAnalyticsChoiceAt',
      'learningAnalyticsDisclosureVersion',
    ]) {
      expect(participantFields).not.toHaveProperty(field)
    }

    const queryField = schema.getQueryType()!.getFields().selfDataUse
    expect(queryField).toBeDefined()
    if (!queryField) return
    expect(queryField.type.toString()).toBe('ParticipantDataUse')
    expect(queryField.args).toHaveLength(0)
  })

  it('filters individual analytics with a strict current-choice freshness check', async () => {
    const queryStatements: string[] = []
    const courseFindUnique = vi.fn(async (args: CourseFindUniqueArgs) => {
      if (args.include.participantCourseAnalytics) {
        return {
          name: 'course',
          startDate: initialTime,
          endDate: nextTime,
          participations: [{ id: 'participation' }],
          aggregatedAnalytics: [
            { type: 'DAILY', timestamp: initialTime, participantCount: 2 },
          ],
          aggregatedCourseAnalytics: null,
          participantCourseAnalytics: [{ activeWeeks: 1 }],
        }
      }

      return {
        name: 'course',
        _count: { participations: 1 },
        practiceQuizzes: [],
        microLearnings: [],
        participantPerformances: [],
      }
    })
    const transactionClient = {
      $queryRaw: vi.fn(async (strings: TemplateStringsArray) => {
        queryStatements.push(strings.join(' '))
        return [{ participantId }]
      }),
      course: { findUnique: courseFindUnique },
    }
    const prisma = {
      $transaction: vi.fn(
        async (callback: (tx: typeof transactionClient) => unknown) =>
          callback(transactionClient)
      ),
    }
    const ctx = { prisma } as unknown as ContextWithUser

    const activityResult = await getCourseActivityAnalytics(
      { courseId: '10000000-0000-4000-8000-000000000001' },
      ctx
    )
    const activityCall = courseFindUnique.mock.calls[0]?.[0]
    if (!activityCall?.include.participantCourseAnalytics) {
      throw new Error('missing activity analytics query')
    }
    expect(
      activityCall.include.participantCourseAnalytics.where.participantId.in
    ).toEqual([participantId])
    expect(activityResult?.dailyActivity).toHaveLength(1)
    expect(activityResult?.participantCourseAnalytics).toHaveLength(1)
    expect(queryStatements[0]).toContain(
      'c."analyticsLastComputedAt" > p."learningAnalyticsChoiceAt"'
    )

    await getCoursePerformanceAnalytics(
      { courseId: '10000000-0000-4000-8000-000000000001' },
      ctx
    )
    expect(queryStatements[1]).toContain(
      'c."analyticsLastComputedAt" > p."learningAnalyticsChoiceAt"'
    )
  })
})
