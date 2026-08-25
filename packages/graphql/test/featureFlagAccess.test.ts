import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import type { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../src/lib/context.js'
import { requireFeatureFlagAccess } from '../src/lib/featureFlags.js'
import {
  getActivityAnalytics,
  getCourseActivityAnalytics,
  getCoursePerformanceAnalytics,
  getCourseWeeklyActivity,
} from '../src/services/analytics.js'

const user = {
  sub: 'user-id',
  role: UserRole.ADMIN,
  scope: UserLoginScope.FULL_ACCESS,
  catalystInstitutional: false,
  catalystIndividual: false,
}

describe('requireFeatureFlagAccess', () => {
  it('passes only sanitized authenticated-user attributes to the evaluator', () => {
    const isEnabled = vi.fn().mockReturnValue(true)

    expect(() =>
      requireFeatureFlagAccess(
        { user, featureFlags: { isEnabled } },
        'learning-analytics'
      )
    ).not.toThrow()
    expect(isEnabled).toHaveBeenCalledWith('learning-analytics', {
      id: 'user-id',
      actorType: 'user',
      role: UserRole.ADMIN,
    })
  })

  it.each([
    ['a missing evaluator', undefined],
    ['a disabled flag', { isEnabled: vi.fn().mockReturnValue(false) }],
    [
      'an evaluation failure',
      {
        isEnabled: vi.fn(() => {
          throw new Error('SDK failure')
        }),
      },
    ],
  ])('fails closed for %s', (_, featureFlags) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    expect(() =>
      requireFeatureFlagAccess({ user, featureFlags }, 'learning-analytics')
    ).toThrowError(
      expect.objectContaining<Partial<GraphQLError>>({
        message: 'Forbidden',
        extensions: { code: 'FORBIDDEN' },
      })
    )

    warn.mockRestore()
  })
})

describe('learning analytics services', () => {
  it.each([
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
  ])('denies %s before accessing Prisma', async (_, getAnalytics) => {
    const prisma = new Proxy(
      {},
      {
        get() {
          throw new Error('Prisma must not be accessed when the flag is off')
        },
      }
    )
    const ctx = {
      user,
      featureFlags: { isEnabled: vi.fn().mockReturnValue(false) },
      prisma,
    } as unknown as ContextWithUser

    await expect(getAnalytics(ctx)).rejects.toMatchObject({
      message: 'Forbidden',
      extensions: { code: 'FORBIDDEN' },
    })
  })
})
