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
  it('returns only the six current-state fields and keeps them out of Participant', () => {
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

  it('records current choices with database time and server-owned v1 metadata', async () => {
    const researchFixture = participantContext()
    await expect(
      setResearchConsent({ consent: false }, researchFixture.ctx)
    ).resolves.toMatchObject({
      researchConsent: false,
      researchConsentChoiceAt: nextTime,
      researchConsentDisclosureVersion: PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    })
    expect(researchFixture.current.researchConsentChoiceAt).toEqual(nextTime)
    expect(researchFixture.queryStatements).toEqual([
      expect.stringContaining('clock_timestamp'),
    ])
    expect(researchFixture.executeStatements).toHaveLength(0)

    const learningAnalyticsFixture = participantContext()
    await expect(
      setLearningAnalyticsConsent(
        {
          consent: true,
        },
        learningAnalyticsFixture.ctx
      )
    ).resolves.toMatchObject({
      learningAnalyticsConsent: true,
      learningAnalyticsChoiceAt: nextTime,
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    })
    expect(learningAnalyticsFixture.executeStatements[0]).toContain(
      'lock_timeout'
    )
    expect(learningAnalyticsFixture.executeStatements[1]).toContain(
      'pg_advisory_xact_lock'
    )
    expect(learningAnalyticsFixture.participant.update).toHaveBeenCalledOnce()
  })

  it('keeps a same-state recorded choice idempotent', async () => {
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
      }),
    })

    await expect(
      setResearchConsent({ consent: true }, fixture.ctx)
    ).resolves.toEqual(fixture.current)
    await expect(
      setLearningAnalyticsConsent({ consent: true }, fixture.ctx)
    ).resolves.toEqual(fixture.current)
    expect(fixture.participant.update).not.toHaveBeenCalled()
    expect(fixture.queryStatements).not.toContain(
      expect.stringContaining('clock_timestamp')
    )
    expect(fixture.executeStatements).toEqual([
      expect.stringContaining('lock_timeout'),
      expect.stringContaining('pg_advisory_xact_lock'),
    ])
    expect(fixture.queryStatements).not.toContain(
      expect.stringContaining('clock_timestamp')
    )
  })

  it('refreshes disclosure metadata and current choice time', async () => {
    const fixture = participantContext({
      state: participantState({
        learningAnalyticsConsent: true,
        learningAnalyticsChoiceAt: initialTime,
        learningAnalyticsDisclosureVersion: 'previous-v1',
      }),
    })

    const result = await setLearningAnalyticsConsent(
      { consent: true },
      fixture.ctx
    )

    expect(result).toMatchObject({
      learningAnalyticsConsent: true,
      learningAnalyticsChoiceAt: nextTime,
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    })
  })

  it('fails closed on an enabled choice with incomplete metadata and repairs on withdrawal', async () => {
    const incomplete = participantContext({
      state: participantState({
        learningAnalyticsConsent: true,
        learningAnalyticsChoiceAt: null,
        learningAnalyticsDisclosureVersion:
          PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
      }),
    })
    await expect(
      setLearningAnalyticsConsent({ consent: true }, incomplete.ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'PARTICIPANT_DATA_USE_MALFORMED_STATE' },
    })
    expect(incomplete.participant.update).not.toHaveBeenCalled()

    await expect(
      setLearningAnalyticsConsent({ consent: false }, incomplete.ctx)
    ).resolves.toMatchObject({
      learningAnalyticsConsent: false,
      learningAnalyticsChoiceAt: nextTime,
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    })
    expect(incomplete.participant.update).toHaveBeenCalledOnce()
  })

  it('uses one database timestamp for each changed current choice', async () => {
    const fixture = participantContext()
    const enabled = await setLearningAnalyticsConsent(
      { consent: true },
      fixture.ctx
    )
    expect(enabled).toMatchObject({
      learningAnalyticsConsent: true,
      learningAnalyticsChoiceAt: nextTime,
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    })

    const withdrawn = await setLearningAnalyticsConsent(
      { consent: false },
      fixture.ctx
    )
    expect(withdrawn).toMatchObject({
      learningAnalyticsConsent: false,
      learningAnalyticsChoiceAt: nextTime,
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    })
    expect(fixture.executeStatements).toHaveLength(4)
    expect(fixture.executeStatements[0]).toContain('lock_timeout')
    expect(
      fixture.queryStatements.filter((sql) => sql.includes('clock_timestamp'))
    ).toHaveLength(2)
  })

  it('normalizes a malformed withdrawn choice', async () => {
    const fixture = participantContext({
      state: participantState({
        learningAnalyticsConsent: false,
        learningAnalyticsChoiceAt: initialTime,
        learningAnalyticsDisclosureVersion: null,
      }),
    })
    await expect(
      setLearningAnalyticsConsent({ consent: false }, fixture.ctx)
    ).resolves.toMatchObject({
      learningAnalyticsConsent: false,
      learningAnalyticsChoiceAt: nextTime,
      learningAnalyticsDisclosureVersion:
        PARTICIPANT_DATA_USE_DISCLOSURE_VERSION,
    })
    expect(fixture.executeStatements).toHaveLength(2)
    expect(
      fixture.queryStatements.filter((sql) => sql.includes('clock_timestamp'))
    ).toHaveLength(1)
    expect(fixture.participant.update).toHaveBeenCalledOnce()
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
    expect(queryStatements[0]).toContain('analyticsLastComputedAt')
    expect(queryStatements[0]).toContain(
      'analyticsLastComputedAt" > p."learningAnalyticsChoiceAt'
    )

    await getCoursePerformanceAnalytics(
      { courseId: '10000000-0000-4000-8000-000000000001' },
      ctx
    )
    expect(queryStatements[1]).toContain(
      'analyticsLastComputedAt" > p."learningAnalyticsChoiceAt'
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
