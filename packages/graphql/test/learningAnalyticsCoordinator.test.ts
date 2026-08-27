import {
  ANALYTICS_ENGINE_CONTRACT_VERSION,
  type CourseWorkflowMode,
} from '@klicker-uzh/analytics-engine-contract'
import type {
  LearningAnalyticsBatchControlInput,
  LearningAnalyticsCourseControlInput,
} from '@klicker-uzh/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  completeLearningAnalyticsCourse,
  getLearningAnalyticsBatchDeadline,
  prepareScheduledLearningAnalyticsBatch,
  selectLearningAnalyticsBatchCourses,
  startLearningAnalyticsCourse,
} from '../src/services/learningAnalyticsCoordinator.js'

const courseId = '10000000-0000-4000-8000-000000000001'
const runId = '20000000-0000-4000-8000-000000000001'

function courseIdAt(index: number): string {
  return `10000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
}

function batchClock({
  localHour = 0,
  localMinute = 30,
}: {
  localHour?: number
  localMinute?: number
} = {}) {
  return {
    localDate: '2026-08-27',
    localHour,
    localMinute,
    stopSpawningAt: new Date('2026-08-27T03:45:00.000Z'),
    hardDeadlineAt: new Date('2026-08-27T04:00:00.000Z'),
  }
}

function validBatchInput(
  overrides: Partial<LearningAnalyticsBatchControlInput> = {}
): LearningAnalyticsBatchControlInput {
  return {
    runId,
    batchDate: '2026-08-27',
    selection: 'nightly',
    includePlatform: true,
    inFlightLimit: 10,
    stopSpawningAt: '2026-08-27T03:45:00.000Z',
    hardDeadlineAt: '2026-08-27T04:00:00.000Z',
    ...overrides,
  }
}

function courseRow(
  index: number,
  overrides: Partial<{
    isLearningAnalyticsEnabled: boolean
    isArchived: boolean
    areAnalyticsValid: boolean
    analyticsLastComputedAt: Date | null
    analyticsFinalizedAt: Date | null
    endDate: Date
    hasDirtyLearningAnalyticsChoice: boolean
  }> = {}
) {
  return {
    id: courseIdAt(index),
    isLearningAnalyticsEnabled: true,
    isArchived: false,
    areAnalyticsValid: true,
    analyticsLastComputedAt: new Date('2026-08-26T00:00:00.000Z'),
    analyticsFinalizedAt: null,
    endDate: new Date('2026-09-01T00:00:00.000Z'),
    hasDirtyLearningAnalyticsChoice: false,
    ...overrides,
  }
}

function courseRequest(
  mode: CourseWorkflowMode = 'incremental'
): LearningAnalyticsCourseControlInput {
  return {
    contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
    runId,
    courseId,
    mode,
  }
}

type CourseState = {
  isLearningAnalyticsEnabled: boolean
  isArchived: boolean
  analyticsLastComputedAt: Date | null
  areAnalyticsValid?: boolean
  analyticsFinalizedAt?: Date | null
  endDate?: Date
}

function coursePrisma(
  initial: CourseState,
  {
    fenceAt = new Date('2026-08-27T02:00:00.000Z'),
    publicationAt = new Date('2026-08-27T03:00:00.000Z'),
    memberChoiceAt = null,
  }: {
    fenceAt?: Date
    publicationAt?: Date
    memberChoiceAt?: Date | null
  } = {}
) {
  let current = {
    areAnalyticsValid: true,
    analyticsFinalizedAt: null,
    endDate: new Date('2026-09-01T00:00:00.000Z'),
    ...initial,
  }
  const queryRaw = vi.fn(
    async (query: { strings?: string[]; values?: unknown[] }) => {
      const sql = query.strings?.join(' ') ?? ''
      if (sql.includes('"fenceAt"')) return [{ fenceAt }]
      if (sql.includes('"publicationAt"')) return [{ publicationAt }]
      if (sql.includes('learningAnalyticsChoiceAt')) {
        const comparisonAt = query.values
          ?.slice()
          .reverse()
          .find((value): value is Date => value instanceof Date)
        return [
          {
            hasRecentChoice:
              memberChoiceAt !== null &&
              comparisonAt !== undefined &&
              memberChoiceAt >= comparisonAt,
          },
        ]
      }
      return []
    }
  )
  const transaction = {
    $executeRaw: vi.fn(async () => 0),
    $queryRaw: queryRaw,
    course: {
      findUnique: vi.fn(async () => ({ ...current })),
      update: vi.fn(
        async ({
          data,
        }: {
          data: Partial<CourseState> & Record<string, unknown>
        }) => {
          current = { ...current, ...data }
          return { ...current }
        }
      ),
    },
  }
  const prisma = {
    $transaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction)
    ),
  }

  return {
    prisma: prisma as unknown as Parameters<
      typeof startLearningAnalyticsCourse
    >[1],
    transaction,
    current,
    queryRaw,
  }
}

afterEach(() => {
  delete process.env.LEARNING_ANALYTICS_COORDINATOR_ENABLED
  delete process.env.LEARNING_ANALYTICS_BATCH_IN_FLIGHT_LIMIT
})

describe('learning analytics coordinator', () => {
  it('accepts delayed nightly dispatch before 01:30 with stable daily run IDs', async () => {
    process.env.LEARNING_ANALYTICS_COORDINATOR_ENABLED = 'true'
    process.env.LEARNING_ANALYTICS_BATCH_IN_FLIGHT_LIMIT = '10'
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([batchClock({ localMinute: 29 })])
      .mockResolvedValueOnce([batchClock()])
      .mockResolvedValueOnce([batchClock({ localHour: 1, localMinute: 29 })])
      .mockResolvedValueOnce([batchClock({ localHour: 1, localMinute: 30 })])
    const prisma = { $queryRaw: queryRaw }

    await expect(
      prepareScheduledLearningAnalyticsBatch(prisma)
    ).resolves.toBeNull()

    const first = await prepareScheduledLearningAnalyticsBatch(prisma)
    const second = await prepareScheduledLearningAnalyticsBatch(prisma)
    await expect(
      prepareScheduledLearningAnalyticsBatch(prisma)
    ).resolves.toBeNull()

    expect(first).not.toBeNull()
    expect(first).toEqual(second)
    expect(first).toMatchObject({
      batchDate: '2026-08-27',
      selection: 'nightly',
      includePlatform: true,
      inFlightLimit: 10,
      stopSpawningAt: '2026-08-27T03:45:00.000Z',
      hardDeadlineAt: '2026-08-27T04:00:00.000Z',
    })
    expect(first?.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    )
    expect(queryRaw).toHaveBeenCalledTimes(4)
  })

  it('derives a replay-stable remaining deadline from the PostgreSQL clock', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ remainingSeconds: 42 }])
      .mockResolvedValueOnce([{ remainingSeconds: 0 }])
      .mockResolvedValueOnce([{ remainingSeconds: -1 }])
      .mockResolvedValueOnce([{ remainingSeconds: null }])
    const prisma = { $queryRaw: queryRaw }

    await expect(
      getLearningAnalyticsBatchDeadline(
        { hardDeadlineAt: '2026-08-27T04:00:00.000Z' },
        prisma
      )
    ).resolves.toEqual({ remainingSeconds: 42 })
    await expect(
      getLearningAnalyticsBatchDeadline(
        { hardDeadlineAt: '2026-08-27T04:00:00.000Z' },
        prisma
      )
    ).resolves.toEqual({ remainingSeconds: 0 })
    await expect(
      getLearningAnalyticsBatchDeadline(
        { hardDeadlineAt: '2026-08-27T04:00:00.000Z' },
        prisma
      )
    ).rejects.toThrow('invalid analytics deadline')
    await expect(
      getLearningAnalyticsBatchDeadline(
        { hardDeadlineAt: '2026-08-27T04:00:00.000Z' },
        prisma
      )
    ).rejects.toThrow('invalid analytics deadline')

    const queryText = queryRaw.mock.calls[0]?.[0] as { strings?: string[] }
    const sql = queryText.strings?.join(' ')
    expect(sql).toContain('clock_timestamp()')
    expect(sql).toContain('WHEN now <')
    expect(sql).toContain('GREATEST')
    expect(sql).toContain('CEIL')
  })

  it('rejects malformed batch controls before querying and pages nightly candidates by course ID', async () => {
    const queryRaw = vi.fn()
    const prisma = { $queryRaw: queryRaw }

    await expect(
      selectLearningAnalyticsBatchCourses(
        validBatchInput({ inFlightLimit: 0 }),
        prisma
      )
    ).rejects.toThrow('Invalid learning-analytics in-flight limit')
    expect(queryRaw).not.toHaveBeenCalled()

    await expect(
      selectLearningAnalyticsBatchCourses(
        validBatchInput({
          selection: 'explicit-full',
          explicitCourseIds: ['not-a-uuid'],
        }),
        prisma
      )
    ).rejects.toThrow('Explicit analytics batches require valid course IDs')
    expect(queryRaw).not.toHaveBeenCalled()

    const firstPage = Array.from({ length: 250 }, (_, index) =>
      courseRow(index)
    )
    const secondPage = [
      courseRow(1000, {
        isLearningAnalyticsEnabled: false,
        analyticsLastComputedAt: null,
      }),
      courseRow(1001, {
        areAnalyticsValid: false,
      }),
      courseRow(1002, {
        endDate: new Date('2026-08-19T00:00:00.000Z'),
      }),
    ]
    queryRaw.mockResolvedValueOnce(firstPage).mockResolvedValueOnce(secondPage)

    const result = await selectLearningAnalyticsBatchCourses(
      validBatchInput(),
      prisma
    )

    expect(queryRaw).toHaveBeenCalledTimes(2)
    const secondQuery = queryRaw.mock.calls[1]?.[0] as {
      strings?: string[]
      values?: unknown[]
    }
    expect(secondQuery.strings?.join(' ')).toContain('c."id" >')
    expect(secondQuery.values).toContain(courseIdAt(249))
    expect(result.courses).toHaveLength(253)
    expect(result.courses[0]).toEqual({
      contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
      runId,
      courseId: courseIdAt(1000),
      mode: 'full',
    })
    expect(result.courses[1]).toMatchObject({
      courseId: courseIdAt(1001),
      mode: 'full',
    })
    expect(result.courses[2]).toMatchObject({
      courseId: courseIdAt(0),
      mode: 'incremental',
      windowSince: '2026-08-26',
    })
    expect(result.courses.at(-1)).toMatchObject({
      courseId: courseIdAt(1002),
      mode: 'finalize',
    })
  })

  it('forces a full nightly recomputation after a dirty membership choice', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValue([
        courseRow(1, { hasDirtyLearningAnalyticsChoice: true }),
        courseRow(0),
        courseRow(2, { analyticsLastComputedAt: null }),
      ])

    const result = await selectLearningAnalyticsBatchCourses(
      validBatchInput(),
      { $queryRaw: queryRaw }
    )

    expect(result.courses).toEqual([
      {
        contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
        runId,
        courseId: courseIdAt(1),
        mode: 'full',
      },
      {
        contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
        runId,
        courseId: courseIdAt(0),
        mode: 'incremental',
        windowSince: '2026-08-26',
      },
      {
        contractVersion: ANALYTICS_ENGINE_CONTRACT_VERSION,
        runId,
        courseId: courseIdAt(2),
        mode: 'full',
      },
    ])

    const queryText = queryRaw.mock.calls[0]?.[0] as {
      strings?: string[]
    }
    expect(queryText.strings?.join(' ')).toContain(
      'candidate_courses AS MATERIALIZED'
    )
    expect(queryText.strings?.join(' ')).toContain(
      'choice_participant."learningAnalyticsChoiceAt"'
    )
    expect(queryText.strings?.join(' ')).toContain(
      '>= c."analyticsLastComputedAt"'
    )
    expect(queryText.strings?.join(' ')).not.toMatch(/included|boundary/i)
  })

  it('captures a database fence after locking, invalidates active courses, and leaves cleanup-only courses unchanged', async () => {
    const fenceAt = new Date('2026-08-27T02:00:00.000Z')
    const active = coursePrisma(
      {
        isLearningAnalyticsEnabled: true,
        isArchived: false,
        analyticsLastComputedAt: new Date('2026-08-26T00:00:00.000Z'),
      },
      { fenceAt }
    )

    await expect(
      startLearningAnalyticsCourse(courseRequest(), active.prisma)
    ).resolves.toEqual({
      courseId,
      request: courseRequest(),
      cleanupOnly: false,
      fenceAt: fenceAt.toISOString(),
    })
    expect(active.transaction.course.update).toHaveBeenCalledWith({
      where: { id: courseId },
      data: { areAnalyticsValid: false, chatAnalyticsValidAt: null },
    })
    expect(active.transaction.$executeRaw).toHaveBeenCalledTimes(2)
    expect(active.queryRaw).toHaveBeenCalledTimes(2)
    const fenceQuery = active.queryRaw.mock.calls[0]?.[0]
    expect(fenceQuery?.strings?.join(' ')).toContain('clock_timestamp()')

    for (const state of [
      { isLearningAnalyticsEnabled: false, isArchived: false },
      { isLearningAnalyticsEnabled: true, isArchived: true },
    ]) {
      const cleanup = coursePrisma({
        ...state,
        analyticsLastComputedAt: null,
      })
      await expect(
        startLearningAnalyticsCourse(courseRequest(), cleanup.prisma)
      ).resolves.toMatchObject({
        courseId,
        cleanupOnly: true,
        fenceAt: expect.any(String),
      })
      expect(cleanup.transaction.course.update).not.toHaveBeenCalled()
    }
  })

  it.each([
    ['incremental', { windowSince: '2026-08-26' }],
    ['finalize', {}],
  ] as const)(
    'upgrades a queued %s request when its current member choice is at the preserved marker',
    async (mode, extra) => {
      const marker = new Date('2026-08-27T01:00:00.000Z')
      const request = { ...courseRequest(mode), ...extra }
      const fixture = coursePrisma(
        {
          isLearningAnalyticsEnabled: true,
          isArchived: false,
          analyticsLastComputedAt: marker,
        },
        { memberChoiceAt: marker }
      )

      await expect(
        startLearningAnalyticsCourse(request, fixture.prisma)
      ).resolves.toMatchObject({
        courseId,
        request: courseRequest('full'),
      })
      expect(fixture.queryRaw).toHaveBeenCalledTimes(2)
      const revisionQuery = fixture.queryRaw.mock.calls[1]?.[0]
      expect(revisionQuery?.strings?.join(' ')).toContain(
        'learningAnalyticsChoiceAt'
      )
      expect(revisionQuery?.values).toContainEqual(marker)
    }
  )

  it('keeps a queued incremental request incremental when current member choices predate the marker', async () => {
    const marker = new Date('2026-08-27T01:00:00.000Z')
    const request = {
      ...courseRequest(),
      windowSince: '2026-08-26',
    }
    const fixture = coursePrisma(
      {
        isLearningAnalyticsEnabled: true,
        isArchived: false,
        analyticsLastComputedAt: marker,
      },
      { memberChoiceAt: new Date(marker.getTime() - 1) }
    )

    await expect(
      startLearningAnalyticsCourse(request, fixture.prisma)
    ).resolves.toMatchObject({ courseId, request })
  })

  it('upgrades a queued incremental request when finalization becomes due before start', async () => {
    const marker = new Date('2026-08-26T00:00:00.000Z')
    const request = {
      ...courseRequest(),
      windowSince: '2026-08-26',
    }
    const fixture = coursePrisma(
      {
        isLearningAnalyticsEnabled: true,
        isArchived: false,
        analyticsLastComputedAt: marker,
        analyticsFinalizedAt: null,
        endDate: new Date('2026-08-20T01:59:59.999Z'),
      },
      {
        fenceAt: new Date('2026-08-27T02:00:00.000Z'),
        memberChoiceAt: new Date(marker.getTime() - 1),
      }
    )

    await expect(
      startLearningAnalyticsCourse(request, fixture.prisma)
    ).resolves.toMatchObject({
      courseId,
      request: courseRequest('finalize'),
    })
  })

  it('upgrades a queued request to full when the preserved marker is missing', async () => {
    const fixture = coursePrisma({
      isLearningAnalyticsEnabled: true,
      isArchived: false,
      analyticsLastComputedAt: null,
    })
    const request = {
      ...courseRequest(),
      windowSince: '2026-08-26',
    }

    await expect(
      startLearningAnalyticsCourse(request, fixture.prisma)
    ).resolves.toMatchObject({
      courseId,
      request: courseRequest('full'),
    })
    expect(fixture.queryRaw).toHaveBeenCalledOnce()
  })

  it('upgrades a direct incremental request to full while analytics are invalid', async () => {
    const fixture = coursePrisma({
      isLearningAnalyticsEnabled: true,
      isArchived: false,
      areAnalyticsValid: false,
      analyticsLastComputedAt: new Date('2026-08-27T01:00:00.000Z'),
    })
    const request = {
      ...courseRequest(),
      windowSince: '2026-08-26',
    }

    await expect(
      startLearningAnalyticsCourse(request, fixture.prisma)
    ).resolves.toMatchObject({
      courseId,
      request: courseRequest('full'),
    })
    expect(fixture.queryRaw).toHaveBeenCalledOnce()
  })

  it.each([
    ['equal to', new Date('2026-08-27T02:00:00.000Z')],
    ['later than', new Date('2026-08-27T02:00:00.001Z')],
  ])(
    'does not publish when a member choice is %s the captured fence',
    async (_relation, memberChoiceAt) => {
      const fenceAt = new Date('2026-08-27T02:00:00.000Z')
      const fixture = coursePrisma(
        {
          isLearningAnalyticsEnabled: true,
          isArchived: false,
          analyticsLastComputedAt: new Date('2026-08-26T00:00:00.000Z'),
          areAnalyticsValid: false,
        },
        { fenceAt, memberChoiceAt }
      )

      await expect(
        completeLearningAnalyticsCourse(
          {
            request: courseRequest(),
            completedAt: '2026-08-27T03:00:00Z',
            cleanupOnly: false,
            fenceAt: fenceAt.toISOString(),
          },
          fixture.prisma
        )
      ).resolves.toEqual({
        courseId,
        completedAt: '2026-08-27T03:00:00Z',
        cleanupOnly: false,
      })
      expect(fixture.transaction.course.update).not.toHaveBeenCalled()
      expect(fixture.current.areAnalyticsValid).toBe(false)
      expect(fixture.queryRaw).toHaveBeenCalledOnce()
      const revisionQuery = fixture.queryRaw.mock.calls[0]?.[0]
      expect(revisionQuery?.strings?.join(' ')).toContain(
        'learningAnalyticsChoiceAt'
      )
      expect(revisionQuery?.strings?.join(' ')).toContain('>=')
      expect(revisionQuery?.values).toContainEqual(fenceAt)
    }
  )

  it('publishes with the database publication timestamp, retains the private completion timestamp, finalizes once, and ignores stale results', async () => {
    const completedAt = '2026-08-27T03:00:00+02:00'
    const publicationAt = new Date('2026-08-27T03:30:00.000Z')
    const fenceAt = new Date('2026-08-27T02:00:00.000Z')
    const fixture = coursePrisma(
      {
        isLearningAnalyticsEnabled: true,
        isArchived: false,
        analyticsLastComputedAt: new Date('2026-08-26T00:00:00.000Z'),
        areAnalyticsValid: false,
      },
      {
        fenceAt,
        publicationAt,
        memberChoiceAt: new Date('2026-08-27T01:59:59.999Z'),
      }
    )

    await expect(
      completeLearningAnalyticsCourse(
        {
          request: courseRequest('finalize'),
          completedAt,
          cleanupOnly: false,
          fenceAt: fenceAt.toISOString(),
        },
        fixture.prisma
      )
    ).resolves.toEqual({ courseId, completedAt, cleanupOnly: false })
    expect(fixture.transaction.course.update).toHaveBeenCalledWith({
      where: { id: courseId },
      data: {
        areAnalyticsValid: true,
        analyticsLastComputedAt: publicationAt,
        chatAnalyticsValidAt: publicationAt,
        analyticsFinalizedAt: publicationAt,
      },
    })

    await expect(
      completeLearningAnalyticsCourse(
        {
          request: courseRequest('finalize'),
          completedAt: '2026-08-27T02:59:59+02:00',
          cleanupOnly: false,
          fenceAt: fenceAt.toISOString(),
        },
        fixture.prisma
      )
    ).resolves.toEqual({
      courseId,
      completedAt: '2026-08-27T02:59:59+02:00',
      cleanupOnly: false,
    })
    expect(fixture.transaction.course.update).toHaveBeenCalledOnce()
    expect(fixture.queryRaw).toHaveBeenCalledTimes(2)
  })

  it('rejects a stale result from the public marker even when its private completion timestamp is later', async () => {
    const fenceAt = new Date('2026-08-27T02:00:00.000Z')
    const fixture = coursePrisma(
      {
        isLearningAnalyticsEnabled: true,
        isArchived: false,
        analyticsLastComputedAt: new Date('2026-08-27T03:00:00.000Z'),
        areAnalyticsValid: false,
      },
      { fenceAt }
    )

    await expect(
      completeLearningAnalyticsCourse(
        {
          request: courseRequest(),
          completedAt: '2026-08-27T05:00:00Z',
          cleanupOnly: false,
          fenceAt: fenceAt.toISOString(),
        },
        fixture.prisma
      )
    ).resolves.toEqual({
      courseId,
      completedAt: '2026-08-27T05:00:00Z',
      cleanupOnly: false,
    })
    expect(fixture.transaction.course.update).not.toHaveBeenCalled()
    expect(fixture.queryRaw).not.toHaveBeenCalled()
  })

  it('does not persist completion for disabled or archived courses', async () => {
    for (const state of [
      { isLearningAnalyticsEnabled: false, isArchived: false },
      { isLearningAnalyticsEnabled: true, isArchived: true },
    ]) {
      const fixture = coursePrisma({
        ...state,
        analyticsLastComputedAt: null,
      })

      await expect(
        completeLearningAnalyticsCourse(
          {
            request: courseRequest(),
            completedAt: '2026-08-27T03:00:00+02:00',
            cleanupOnly: false,
            fenceAt: '2026-08-27T02:00:00.000Z',
          },
          fixture.prisma
        )
      ).resolves.toEqual({
        courseId,
        completedAt: '2026-08-27T03:00:00+02:00',
        cleanupOnly: true,
      })
      expect(fixture.transaction.course.update).not.toHaveBeenCalled()
    }
  })
})
