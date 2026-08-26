import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
  type ParticipantDataUseFields,
} from '../src/lib/learningAnalytics.js'
import {
  getCourseActivityAnalytics,
  getCoursePerformanceAnalytics,
} from '../src/services/analytics.js'
import {
  getParticipantDataUse,
  setLearningAnalyticsConsent,
  setResearchConsent,
} from '../src/services/participants.js'

const participantId = '00000000-0000-4000-8000-000000000001'
const initialTime = new Date('2026-08-26T18:00:00.000Z')
const nextTime = new Date('2026-08-26T18:01:00.000Z')

function participantState(
  overrides: Partial<ParticipantDataUseFields> = {}
): ParticipantDataUseFields {
  return {
    researchConsent: false,
    researchConsentChoiceAt: null,
    researchConsentDisclosureVersion: null,
    learningAnalyticsConsent: false,
    learningAnalyticsChoiceAt: null,
    learningAnalyticsDisclosureVersion: null,
    learningAnalyticsIncludedFrom: null,
    ...overrides,
  }
}

function participantContext({
  state = participantState(),
  databaseTime = nextTime,
  role = UserRole.PARTICIPANT,
  lockError = false,
  transactionError,
}: {
  state?: ParticipantDataUseFields
  databaseTime?: Date
  role?: UserRole
  lockError?: boolean
  transactionError?: unknown
} = {}) {
  const current = { ...state }
  const queryStatements: string[] = []
  const executeStatements: string[] = []
  const queryRaw = vi.fn(
    async (strings: TemplateStringsArray): Promise<Array<{ now?: Date }>> => {
      const sql = strings.join(' ')
      queryStatements.push(sql)
      if (sql.includes('clock_timestamp')) return [{ now: databaseTime }]
      return []
    }
  )
  const executeRaw = vi.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join(' ')
    executeStatements.push(sql)
    if (lockError && sql.includes('pg_advisory_xact_lock')) {
      throw {
        code: 'P2010',
        meta: { code: '55P03' },
        message: 'Raw query failed. Code: 55P03. Message: lock timeout',
      }
    }
    return 0
  })
  const participant = {
    findUnique: vi.fn(async () => ({ ...current })),
    update: vi.fn(
      async ({ data }: { data: Partial<ParticipantDataUseFields> }) => {
        Object.assign(current, data)
        return { ...current }
      }
    ),
  }
  const transaction = {
    participant,
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
  }
  const prisma = {
    participant,
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    $transaction: vi.fn(
      async (callback: (tx: typeof transaction) => unknown) => {
        if (transactionError) throw transactionError
        return callback(transaction)
      }
    ),
  }
  const ctx = {
    prisma,
    user: {
      sub: participantId,
      role,
      scope: UserLoginScope.FULL_ACCESS,
      catalystIndividual: false,
      catalystInstitutional: false,
    },
  } as unknown as ContextWithUser

  return {
    ctx,
    current,
    participant,
    prisma,
    queryStatements,
    executeStatements,
  }
}

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
  it('returns only the seven current-state fields and keeps them out of Participant', () => {
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
      'learningAnalyticsIncludedFrom',
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
    expect(participantFields).not.toHaveProperty('researchConsent')
    expect(participantFields).not.toHaveProperty('learningAnalyticsConsent')

    const queryField = schema.getQueryType()!.getFields().selfDataUse
    expect(queryField).toBeDefined()
    if (!queryField) return
    expect(queryField.type.toString()).toBe('ParticipantDataUse')
    expect(queryField.args).toHaveLength(0)
  })

  it('defends self-only access in the service layer', async () => {
    const userContext = participantContext({ role: UserRole.USER })
    await expect(getParticipantDataUse(userContext.ctx)).resolves.toBeNull()
    await expect(
      setResearchConsent({ consent: true }, userContext.ctx)
    ).resolves.toBeNull()
    await expect(
      setLearningAnalyticsConsent({ consent: true }, userContext.ctx)
    ).resolves.toBeNull()
    expect(userContext.prisma.$transaction).not.toHaveBeenCalled()
  })

  it('records the initial explicit no with database time and v1', async () => {
    const fixture = participantContext()
    const result = await setResearchConsent({ consent: false }, fixture.ctx)

    expect(result).toMatchObject({
      researchConsent: false,
      researchConsentChoiceAt: nextTime,
      researchConsentDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    })
    expect(fixture.current.researchConsentChoiceAt).toEqual(nextTime)
    expect(fixture.current.learningAnalyticsIncludedFrom).toBeNull()
    expect(fixture.queryStatements).toEqual([
      expect.stringContaining('clock_timestamp'),
    ])
    expect(fixture.executeStatements).toHaveLength(0)

    const learningAnalyticsFixture = participantContext()
    const learningAnalyticsResult = await setLearningAnalyticsConsent(
      { consent: false },
      learningAnalyticsFixture.ctx
    )
    expect(learningAnalyticsResult).toMatchObject({
      learningAnalyticsConsent: false,
      learningAnalyticsChoiceAt: nextTime,
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      learningAnalyticsIncludedFrom: null,
    })
    expect(learningAnalyticsFixture.executeStatements[0]).toContain(
      'lock_timeout'
    )
  })

  it('keeps a same-state recorded choice idempotent', async () => {
    const boundary = new Date('2026-08-01T00:00:00.000Z')
    const choiceAt = new Date('2026-08-02T00:00:00.000Z')
    const fixture = participantContext({
      state: participantState({
        researchConsent: true,
        researchConsentChoiceAt: choiceAt,
        researchConsentDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        learningAnalyticsConsent: true,
        learningAnalyticsChoiceAt: choiceAt,
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        learningAnalyticsIncludedFrom: boundary,
      }),
    })

    await expect(
      setResearchConsent({ consent: true }, fixture.ctx)
    ).resolves.toEqual(fixture.current)
    await expect(
      setLearningAnalyticsConsent({ consent: true }, fixture.ctx)
    ).resolves.toEqual(fixture.current)
    expect(fixture.participant.update).not.toHaveBeenCalled()
    expect(fixture.executeStatements).toEqual([
      expect.stringContaining('lock_timeout'),
      expect.stringContaining('pg_advisory_xact_lock'),
    ])
    expect(fixture.queryStatements).not.toContain(
      expect.stringContaining('clock_timestamp')
    )
    expect(fixture.current.learningAnalyticsIncludedFrom).toEqual(boundary)
  })

  it('refreshes disclosure metadata without moving the learning boundary', async () => {
    const boundary = new Date('2026-08-01T00:00:00.000Z')
    const fixture = participantContext({
      state: participantState({
        learningAnalyticsConsent: true,
        learningAnalyticsChoiceAt: initialTime,
        learningAnalyticsDisclosureVersion: 'previous-v1',
        learningAnalyticsIncludedFrom: boundary,
      }),
    })
    expect(boundary.getTime()).toBeLessThan(initialTime.getTime())

    const result = await setLearningAnalyticsConsent(
      { consent: true },
      fixture.ctx
    )

    expect(result).toMatchObject({
      learningAnalyticsConsent: true,
      learningAnalyticsChoiceAt: nextTime,
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      learningAnalyticsIncludedFrom: boundary,
    })
    expect(fixture.participant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          learningAnalyticsIncludedFrom: expect.anything(),
        }),
      })
    )
  })

  it('fails closed on an enabled boundary after its recorded choice and repairs on withdrawal', async () => {
    const choiceAt = new Date('2026-08-02T00:00:00.000Z')
    const impossibleBoundary = new Date('2026-08-03T00:00:00.000Z')
    const fixture = participantContext({
      state: participantState({
        learningAnalyticsConsent: true,
        learningAnalyticsChoiceAt: choiceAt,
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        learningAnalyticsIncludedFrom: impossibleBoundary,
      }),
    })

    await expect(
      setLearningAnalyticsConsent({ consent: true }, fixture.ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_MALFORMED_STATE' },
    })
    expect(fixture.participant.update).not.toHaveBeenCalled()

    await expect(
      setLearningAnalyticsConsent({ consent: false }, fixture.ctx)
    ).resolves.toMatchObject({
      learningAnalyticsConsent: false,
      learningAnalyticsChoiceAt: nextTime,
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      learningAnalyticsIncludedFrom: null,
    })
  })

  it('uses one database timestamp for a false-to-true boundary and clears it on withdrawal', async () => {
    const fixture = participantContext()
    const included = await setLearningAnalyticsConsent(
      { consent: true },
      fixture.ctx
    )
    expect(included).toMatchObject({
      learningAnalyticsConsent: true,
      learningAnalyticsChoiceAt: nextTime,
      learningAnalyticsIncludedFrom: nextTime,
    })

    const withdrawn = await setLearningAnalyticsConsent(
      { consent: false },
      fixture.ctx
    )
    expect(withdrawn).toMatchObject({
      learningAnalyticsConsent: false,
      learningAnalyticsChoiceAt: nextTime,
      learningAnalyticsIncludedFrom: null,
    })
    expect(fixture.executeStatements).toHaveLength(4)
    expect(fixture.executeStatements[0]).toContain('lock_timeout')
    expect(
      fixture.queryStatements.filter((sql) => sql.includes('clock_timestamp'))
    ).toHaveLength(2)
  })

  it('fails closed on malformed enablement and normalizes withdrawal', async () => {
    const fixture = participantContext({
      state: participantState({
        learningAnalyticsConsent: true,
        learningAnalyticsChoiceAt: null,
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        learningAnalyticsIncludedFrom: null,
      }),
    })

    await expect(
      setLearningAnalyticsConsent({ consent: true }, fixture.ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_MALFORMED_STATE' },
    })
    expect(fixture.participant.update).not.toHaveBeenCalled()
    expect(fixture.queryStatements).not.toContain(
      expect.stringContaining('clock_timestamp')
    )

    const contradictoryWithdrawal = participantContext({
      state: participantState({
        learningAnalyticsConsent: false,
        learningAnalyticsChoiceAt: initialTime,
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
        learningAnalyticsIncludedFrom: initialTime,
      }),
    })
    await expect(
      setLearningAnalyticsConsent(
        { consent: false },
        contradictoryWithdrawal.ctx
      )
    ).resolves.toMatchObject({
      learningAnalyticsConsent: false,
      learningAnalyticsChoiceAt: nextTime,
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      learningAnalyticsIncludedFrom: null,
    })
    expect(contradictoryWithdrawal.participant.update).toHaveBeenCalledOnce()
  })

  it('uses a bounded global lock and maps lock timeout without changing state', async () => {
    const fixture = participantContext({ lockError: true })
    await expect(
      setLearningAnalyticsConsent({ consent: true }, fixture.ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_LOCK_TIMEOUT' },
    })
    expect(fixture.executeStatements[0]).toContain(
      "SET LOCAL lock_timeout = '5s'"
    )
    expect(fixture.executeStatements[1]).toContain('pg_advisory_xact_lock')
    expect(fixture.participant.findUnique).not.toHaveBeenCalled()
    expect(fixture.participant.update).not.toHaveBeenCalled()
  })

  it('does not take the learning-analytics lock for research changes', async () => {
    const fixture = participantContext()
    await setResearchConsent({ consent: true }, fixture.ctx)
    expect(fixture.executeStatements).toHaveLength(0)
    expect(fixture.queryStatements).not.toContain(
      expect.stringContaining('pg_advisory_xact_lock')
    )
  })

  it('filters individual analytics at the source while preserving aggregate output', async () => {
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
          participantCourseAnalytics: [
            {
              activeWeeks: 1,
              activeDaysPerWeek: 1,
              meanElementsPerDay: 1,
              activityLevel: 'HIGH',
            },
          ],
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
    const activityWhere = activityCall.include.participantCourseAnalytics.where
    expect(activityWhere.participantId.in).toEqual([participantId])
    expect(activityWhere).not.toHaveProperty('participant')
    expect(activityResult?.dailyActivity).toHaveLength(1)
    expect(activityResult?.participantCourseAnalytics).toHaveLength(1)
    expect(queryStatements[0]).toContain('analyticsLastComputedAt')
    expect(queryStatements[0]).toContain('learningAnalyticsIncludedFrom')
    expect(queryStatements[0]).toContain(
      'learningAnalyticsIncludedFrom" <= p."learningAnalyticsChoiceAt'
    )

    await getCoursePerformanceAnalytics(
      { courseId: '10000000-0000-4000-8000-000000000001' },
      ctx
    )
    const performanceCall = courseFindUnique.mock.calls[1]?.[0]
    if (!performanceCall?.include.participantPerformances) {
      throw new Error('missing performance analytics query')
    }
    const performanceWhere =
      performanceCall.include.participantPerformances.where
    expect(performanceWhere.participantId.in).toEqual([participantId])
    expect(performanceWhere).not.toHaveProperty('participant')
    expect(queryStatements[1]).toContain('ParticipantPerformance')
    expect(queryStatements[1]).toContain('ParticipantActivityPerformance')
    expect(queryStatements[1]).toContain(
      'learningAnalyticsIncludedFrom" <= p."learningAnalyticsChoiceAt'
    )
  })

  it('propagates generic transaction timeouts instead of relabeling them as lock timeouts', async () => {
    const transactionError = {
      code: 'P2028',
      message: 'Transaction already closed: expired transaction timeout',
    }
    const fixture = participantContext({ transactionError })

    await expect(
      setLearningAnalyticsConsent({ consent: true }, fixture.ctx)
    ).rejects.toBe(transactionError)
    expect(fixture.executeStatements).toHaveLength(0)
    expect(fixture.participant.findUnique).not.toHaveBeenCalled()
  })
})
