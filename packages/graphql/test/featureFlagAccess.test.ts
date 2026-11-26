import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import type { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../src/lib/context.js'
import { requireFeatureFlagAccess } from '../src/lib/featureFlags.js'
import { isLearningAnalyticsEnabled } from '../src/lib/learningAnalytics.js'
import {
  getActivityAnalytics,
  getCourseActivityAnalytics,
  getCoursePerformanceAnalytics,
  getCourseWeeklyActivity,
} from '../src/services/analytics.js'

// The release switch stays off until consent-aware processing ships; the
// service tests below enable it to exercise the fail-closed flag guard.
vi.mock('../src/lib/learningAnalytics.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../src/lib/learningAnalytics.js')>()
  return { ...actual, isLearningAnalyticsEnabled: vi.fn(() => true) }
})

const user = {
  sub: 'user-id',
  role: UserRole.ADMIN,
  scope: UserLoginScope.FULL_ACCESS,
  catalystInstitutional: false,
  catalystIndividual: false,
}

describe('requireFeatureFlagAccess', () => {
  it('passes only sanitized authenticated-user attributes to the evaluator', async () => {
    const isEnabled = vi.fn().mockReturnValue(true)
    const preferenceLookup = vi.fn().mockResolvedValue({ betaEnabled: true })

    await expect(
      requireFeatureFlagAccess(
        {
          user,
          featureFlags: {
            isEnabled,
            getAiBetaDecision: vi.fn(),
            refresh: vi.fn(async () => undefined),
          },
          prisma: { user: { findUnique: preferenceLookup } },
        } as unknown as ContextWithUser,
        'learning-analytics'
      )
    ).resolves.toBeUndefined()
    expect(isEnabled).toHaveBeenCalledWith('learning-analytics', {
      id: 'user-id',
      actorType: 'user',
      role: UserRole.ADMIN,
      catalyst: false,
      betaEnabled: true,
    })
  })

  it.each([
    ['a missing evaluator', undefined],
    [
      'a disabled flag',
      {
        isEnabled: vi.fn().mockReturnValue(false),
        getAiBetaDecision: vi.fn(),
        refresh: vi.fn(async () => undefined),
      },
    ],
    [
      'an evaluation failure',
      {
        isEnabled: vi.fn(() => {
          throw new Error('SDK failure')
        }),
        getAiBetaDecision: vi.fn(),
        refresh: vi.fn(async () => undefined),
      },
    ],
  ])('fails closed for %s', async (_, featureFlags) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const preferenceLookup = vi.fn().mockResolvedValue({ betaEnabled: true })

    await expect(
      requireFeatureFlagAccess(
        {
          user,
          featureFlags,
          prisma: { user: { findUnique: preferenceLookup } },
        } as unknown as ContextWithUser,
        'learning-analytics'
      )
    ).rejects.toThrowError(
      expect.objectContaining<Partial<GraphQLError>>({
        message: 'Forbidden',
        extensions: { code: 'FORBIDDEN' },
      })
    )
    warn.mockRestore()
  })
})

const learningAnalyticsServices: [
  string,
  (ctx: ContextWithUser) => Promise<unknown>,
][] = [
  [
    'course activity analytics',
    (ctx: ContextWithUser) =>
      getCourseActivityAnalytics({ courseId: 'course-id' }, ctx),
  ],
  [
    'weekly course activity',
    (ctx: ContextWithUser) =>
      getCourseWeeklyActivity({ courseId: 'course-id' }, ctx),
  ],
  [
    'course performance analytics',
    (ctx: ContextWithUser) =>
      getCoursePerformanceAnalytics({ courseId: 'course-id' }, ctx),
  ],
  [
    'activity analytics',
    (ctx: ContextWithUser) =>
      getActivityAnalytics({ activityId: 'activity-id' }, ctx),
  ],
]

describe('learning analytics services', () => {
  it.each(
    learningAnalyticsServices
  )('denies %s before accessing service data', async (_, getAnalytics) => {
    vi.mocked(isLearningAnalyticsEnabled).mockReturnValue(true)
    const preferenceLookup = vi.fn().mockResolvedValue({ betaEnabled: true })
    const prisma = new Proxy(
      { user: { findUnique: preferenceLookup } },
      {
        get(target, property, receiver) {
          if (property === 'user') {
            return Reflect.get(target, property, receiver)
          }
          throw new Error('Prisma service data must not be accessed')
        },
      }
    )
    const ctx = {
      user,
      featureFlags: {
        isEnabled: vi.fn().mockReturnValue(false),
        getAiBetaDecision: vi.fn(),
        refresh: vi.fn(async () => undefined),
      },
      prisma,
    } as unknown as ContextWithUser

    await expect(getAnalytics(ctx)).rejects.toMatchObject({
      message: 'Forbidden',
      extensions: { code: 'FORBIDDEN' },
    })
    expect(preferenceLookup).toHaveBeenCalledWith({
      where: { id: user.sub },
      select: { betaEnabled: true },
    })
  })

  it.each(
    learningAnalyticsServices
  )('hides %s while the learning analytics release is disabled', async (_, getAnalytics) => {
    vi.mocked(isLearningAnalyticsEnabled).mockReturnValue(false)
    const prisma = new Proxy(
      {},
      {
        get() {
          throw new Error('Prisma service data must not be accessed')
        },
      }
    )
    const ctx = { user, prisma } as unknown as ContextWithUser

    await expect(getAnalytics(ctx)).resolves.toBeNull()
  })
})
