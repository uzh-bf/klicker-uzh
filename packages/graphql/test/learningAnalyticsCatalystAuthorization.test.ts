import {
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { createYoga } from 'graphql-yoga'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const serviceMocks = vi.hoisted(() => ({
  getCourseActivityAnalyticsV2: vi.fn(),
  getCourseLearningAnalyticsExportV2: vi.fn(),
  getCoursePerformanceAnalyticsV2: vi.fn(),
  setCourseLearningAnalyticsEnabled: vi.fn(),
}))

vi.mock('../src/services/analytics.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...serviceMocks,
}))
vi.mock('../src/services/courses.js', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ...serviceMocks,
}))

import { schema } from '../src/index.js'
import type { ContextWithUser } from '../src/lib/context.js'

const courseId = '10000000-0000-4000-8000-000000000001'

const readOperations = [
  'getCourseActivityAnalyticsV2',
  'getCoursePerformanceAnalyticsV2',
  'getCourseLearningAnalyticsExportV2',
] as const

const gatedOperations = [
  'setCourseLearningAnalyticsEnabled',
  'recomputeCourseAnalytics',
  ...readOperations,
] as const

type GatedOperation = (typeof gatedOperations)[number]

function buildContext({
  catalystInstitutional = false,
  catalystIndividual = false,
  permissionLevel = PermissionLevel.ADMIN,
  role = UserRole.USER,
}: {
  catalystInstitutional?: boolean
  catalystIndividual?: boolean
  permissionLevel?: PermissionLevel | null
  role?: UserRole
} = {}) {
  const derivedPermissionFindUnique = vi
    .fn()
    .mockImplementation(
      async ({
        where,
      }: {
        where: { permissionLevel: { in: PermissionLevel[] } }
      }) =>
        permissionLevel && where.permissionLevel.in.includes(permissionLevel)
          ? { permissionLevel }
          : null
    )
  const courseFindUnique = vi.fn().mockResolvedValue({
    analyticsLastComputedAt: null,
  })
  const queryRaw = vi.fn()
  const courseRunNoWait = vi.fn().mockResolvedValue(undefined)
  const batchRunNoWait = vi.fn().mockResolvedValue(undefined)

  const context = {
    prisma: {
      $queryRaw: queryRaw,
      course: { findUnique: courseFindUnique },
      derivedPermission: { findUnique: derivedPermissionFindUnique },
    },
    tasks: {
      learningAnalyticsBatchCoordinator: { runNoWait: batchRunNoWait },
      learningAnalyticsCourseCoordinator: { runNoWait: courseRunNoWait },
    },
    user: {
      sub: '00000000-0000-0000-0000-000000000001',
      role,
      scope: UserLoginScope.FULL_ACCESS,
      catalystInstitutional,
      catalystIndividual,
    },
  } as unknown as ContextWithUser

  return {
    context,
    batchRunNoWait,
    courseFindUnique,
    derivedPermissionFindUnique,
    queryRaw,
    runNoWait: courseRunNoWait,
  }
}

function operationQuery(
  operation: GatedOperation,
  { isEnabled = true }: { isEnabled?: boolean } = {}
): string {
  switch (operation) {
    case 'setCourseLearningAnalyticsEnabled':
      return `
        mutation {
          setCourseLearningAnalyticsEnabled(
            courseId: "${courseId}"
            isEnabled: ${isEnabled}
          ) {
            id
            isLearningAnalyticsEnabled
          }
        }
      `
    case 'recomputeCourseAnalytics':
      return `
        mutation {
          recomputeCourseAnalytics(courseId: "${courseId}", mode: FULL)
        }
      `
    case 'getCourseActivityAnalyticsV2':
      return `
        query {
          getCourseActivityAnalyticsV2(courseId: "${courseId}") {
            isSuppressed
            effectiveN
          }
        }
      `
    case 'getCoursePerformanceAnalyticsV2':
      return `
        query {
          getCoursePerformanceAnalyticsV2(courseId: "${courseId}") {
            isSuppressed
            effectiveN
          }
        }
      `
    case 'getCourseLearningAnalyticsExportV2':
      return `
        query {
          getCourseLearningAnalyticsExportV2(
            courseId: "${courseId}"
            format: CSV
          ) {
            format
            filename
          }
        }
      `
  }
}

async function executeOperation(
  operation: GatedOperation,
  context: ContextWithUser,
  options?: { isEnabled?: boolean }
) {
  const yoga = createYoga({
    schema,
    context: () => context,
    graphqlEndpoint: '/graphql',
  })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: operationQuery(operation, options) }),
  })

  return (await response.json()) as {
    data?: Record<string, unknown>
    errors?: { message: string; extensions?: { code?: string } }[]
  }
}

async function executeAdminBatch(context: ContextWithUser) {
  const yoga = createYoga({
    schema,
    context: () => context,
    graphqlEndpoint: '/graphql',
  })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation {
          recomputeLearningAnalyticsBatch(courseIds: ["${courseId}"])
        }
      `,
    }),
  })

  return (await response.json()) as {
    data?: Record<string, unknown>
    errors?: { message: string; extensions?: { code?: string } }[]
  }
}

function resetServiceMocks() {
  for (const mock of Object.values(serviceMocks)) mock.mockReset()
  serviceMocks.setCourseLearningAnalyticsEnabled.mockResolvedValue({
    id: courseId,
    isLearningAnalyticsEnabled: true,
  })
  serviceMocks.getCourseActivityAnalyticsV2.mockResolvedValue({
    isSuppressed: false,
    effectiveN: 5,
    weeklyActivity: [],
  })
  serviceMocks.getCoursePerformanceAnalyticsV2.mockResolvedValue({
    isSuppressed: false,
    effectiveN: 5,
    activitySummaries: [],
    studentReport: {
      isSuppressed: false,
      effectiveN: 5,
      students: [],
    },
  })
  serviceMocks.getCourseLearningAnalyticsExportV2.mockResolvedValue({
    format: 'CSV',
    filename: 'learning-analytics-v2.csv',
    mimeType: 'text/csv',
    effectiveN: 5,
    content: 'schemaVersion,effectiveN\nv2,5\n',
  })
}

describe('Catalyst learning-analytics GraphQL gates', () => {
  beforeEach(() => {
    resetServiceMocks()
    process.env.CATALYST_LEARNING_ANALYTICS_AVAILABLE = 'true'
    process.env.LEARNING_ANALYTICS_COORDINATOR_ENABLED = 'true'
  })

  afterEach(() => {
    delete process.env.CATALYST_LEARNING_ANALYTICS_AVAILABLE
    delete process.env.LEARNING_ANALYTICS_COORDINATOR_ENABLED
  })

  it.each([
    ['institutional', { catalystInstitutional: true }],
    ['individual', { catalystIndividual: true }],
  ])('allows %s Catalyst entitlement through all V2 reads and the course control', async (_, entitlement) => {
    const { context } = buildContext(entitlement)

    for (const operation of [
      'setCourseLearningAnalyticsEnabled',
      'recomputeCourseAnalytics',
      ...readOperations,
    ] as const) {
      const result = await executeOperation(operation, context)
      expect(result.errors, operation).toBeUndefined()
    }

    expect(
      serviceMocks.setCourseLearningAnalyticsEnabled
    ).toHaveBeenCalledTimes(1)
    expect(serviceMocks.getCourseActivityAnalyticsV2).toHaveBeenCalledTimes(1)
    expect(serviceMocks.getCoursePerformanceAnalyticsV2).toHaveBeenCalledTimes(
      1
    )
    expect(
      serviceMocks.getCourseLearningAnalyticsExportV2
    ).toHaveBeenCalledTimes(1)
  })

  it.each(
    gatedOperations
  )('rejects a non-Catalyst user at the GraphQL boundary for %s', async (operation) => {
    const {
      context,
      derivedPermissionFindUnique,
      courseFindUnique,
      runNoWait,
    } = buildContext()

    const result = await executeOperation(operation, context)

    expect(result.errors?.[0]?.message, operation).toBe('Unauthorized')
    expect(derivedPermissionFindUnique, operation).not.toHaveBeenCalled()
    expect(courseFindUnique, operation).not.toHaveBeenCalled()
    expect(runNoWait, operation).not.toHaveBeenCalled()
    for (const mock of Object.values(serviceMocks)) {
      expect(mock, operation).not.toHaveBeenCalled()
    }
  })

  it.each(
    gatedOperations
  )('keeps course permission required for %s', async (operation) => {
    const { context, derivedPermissionFindUnique, runNoWait } = buildContext({
      catalystInstitutional: true,
      permissionLevel: null,
    })

    const result = await executeOperation(operation, context)

    expect(result.errors, operation).toBeUndefined()
    expect(result.data?.[operation] ?? null, operation).toBeNull()
    expect(derivedPermissionFindUnique, operation).toHaveBeenCalledTimes(1)
    expect(runNoWait, operation).not.toHaveBeenCalled()
    for (const mock of Object.values(serviceMocks)) {
      expect(mock, operation).not.toHaveBeenCalled()
    }
  })

  it.each(
    gatedOperations
  )('fails closed when Catalyst learning analytics is unavailable for %s', async (operation) => {
    process.env.CATALYST_LEARNING_ANALYTICS_AVAILABLE = 'false'
    const {
      context,
      derivedPermissionFindUnique,
      courseFindUnique,
      runNoWait,
    } = buildContext({ catalystIndividual: true })

    const result = await executeOperation(operation, context)

    expect(result.errors?.[0]?.message, operation).toBe(
      'CATALYST_LEARNING_ANALYTICS_UNAVAILABLE'
    )
    expect(result.errors?.[0]?.extensions?.code, operation).toBe(
      'CATALYST_LEARNING_ANALYTICS_UNAVAILABLE'
    )
    expect(derivedPermissionFindUnique, operation).toHaveBeenCalledTimes(1)
    expect(courseFindUnique, operation).not.toHaveBeenCalled()
    expect(runNoWait, operation).not.toHaveBeenCalled()
    for (const mock of Object.values(serviceMocks)) {
      expect(mock, operation).not.toHaveBeenCalled()
    }
  })

  it('allows an entitled course admin to disable learning analytics while Catalyst is unavailable', async () => {
    process.env.CATALYST_LEARNING_ANALYTICS_AVAILABLE = 'false'
    serviceMocks.setCourseLearningAnalyticsEnabled.mockResolvedValue({
      id: courseId,
      isLearningAnalyticsEnabled: false,
    })
    const { context, runNoWait } = buildContext({
      catalystIndividual: true,
    })

    const result = await executeOperation(
      'setCourseLearningAnalyticsEnabled',
      context,
      { isEnabled: false }
    )

    expect(result.errors).toBeUndefined()
    expect(result.data?.setCourseLearningAnalyticsEnabled).toEqual({
      id: courseId,
      isLearningAnalyticsEnabled: false,
    })
    expect(
      serviceMocks.setCourseLearningAnalyticsEnabled
    ).toHaveBeenCalledOnce()
    expect(
      serviceMocks.setCourseLearningAnalyticsEnabled.mock.calls[0]?.[0]
    ).toEqual({ courseId, isEnabled: false })
    expect(runNoWait).not.toHaveBeenCalled()
  })

  it.each([
    [PermissionLevel.ADMIN, true],
    [PermissionLevel.WRITE, false],
    [PermissionLevel.READ, false],
  ])('requires course ADMIN permission for the learning-analytics control when the caller has %s', async (permissionLevel, isAllowed) => {
    const { context } = buildContext({
      catalystInstitutional: true,
      permissionLevel,
    })

    const result = await executeOperation(
      'setCourseLearningAnalyticsEnabled',
      context
    )

    expect(result.errors).toBeUndefined()
    expect(result.data?.setCourseLearningAnalyticsEnabled ?? null).toEqual(
      isAllowed ? { id: courseId, isLearningAnalyticsEnabled: true } : null
    )
    expect(
      serviceMocks.setCourseLearningAnalyticsEnabled
    ).toHaveBeenCalledTimes(isAllowed ? 1 : 0)
  })

  it('rejects the admin batch before database access or Hatchet enqueue when Catalyst is unavailable', async () => {
    process.env.CATALYST_LEARNING_ANALYTICS_AVAILABLE = 'false'
    const { context, batchRunNoWait, queryRaw } = buildContext({
      role: UserRole.ADMIN,
    })

    const result = await executeAdminBatch(context)

    expect(result.errors?.[0]?.message).toBe(
      'CATALYST_LEARNING_ANALYTICS_UNAVAILABLE'
    )
    expect(result.errors?.[0]?.extensions?.code).toBe(
      'CATALYST_LEARNING_ANALYTICS_UNAVAILABLE'
    )
    expect(queryRaw).not.toHaveBeenCalled()
    expect(batchRunNoWait).not.toHaveBeenCalled()
  })
})
