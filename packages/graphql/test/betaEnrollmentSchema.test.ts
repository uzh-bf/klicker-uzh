import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { createYoga } from 'graphql-yoga'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { Context } from '../src/lib/context.js'

const USER_ID = '00000000-0000-4000-8000-000000000001'

function context({
  authenticated = true,
  catalyst = true,
  flagEnabled = true,
  scope = UserLoginScope.FULL_ACCESS,
}: {
  authenticated?: boolean
  catalyst?: boolean
  flagEnabled?: boolean
  scope?: UserLoginScope
} = {}): Context {
  return {
    featureFlags: { isEnabled: vi.fn(() => flagEnabled) },
    redisExec: {
      set: vi.fn(async () => 'OK'),
      eval: vi.fn(async (script: string) =>
        script.includes('pttl') ? 8_000 : 1
      ),
    },
    user: authenticated
      ? {
          sub: USER_ID,
          role: UserRole.USER,
          scope,
          catalystInstitutional: catalyst,
          catalystIndividual: false,
        }
      : undefined,
  } as unknown as Context
}

async function execute(source: string, ctx: Context) {
  const yoga = createYoga({
    schema,
    context: () => ctx,
    graphqlEndpoint: '/graphql',
  })
  const response = await yoga.fetch('http://localhost/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: source }),
  })
  return (await response.json()) as {
    data?: Record<string, unknown>
    errors?: { message: string }[]
  }
}

function savedGroupResponse(values: string[]) {
  return new Response(
    JSON.stringify({ savedGroup: { type: 'list', values } }),
    {
      status: 200,
    }
  )
}

describe('beta enrollment schema authorization', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    process.env.GROWTHBOOK_MANAGEMENT_API_URL = 'https://growthbook.test'
    process.env.GROWTHBOOK_MANAGEMENT_API_KEY = 'secret_test'
    process.env.GROWTHBOOK_BETA_SAVED_GROUP_ID = 'group_test'
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    delete process.env.GROWTHBOOK_MANAGEMENT_API_URL
    delete process.env.GROWTHBOOK_MANAGEMENT_API_KEY
    delete process.env.GROWTHBOOK_BETA_SAVED_GROUP_ID
    fetchMock.mockReset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('rejects an anonymous capability query', async () => {
    const result = await execute(
      `query {
        betaEnrollment { membership }
      }`,
      context({ authenticated: false })
    )

    expect(result.errors?.[0]?.message).toBe('Unauthorized')
  })

  it.each([
    UserLoginScope.READ_ONLY,
    UserLoginScope.SESSION_EXEC,
  ])('does not expose membership to %s sessions', async (scope) => {
    const result = await execute(
      `query {
          betaEnrollment {
            mayChange
            membership
            signupAvailable
          }
        }`,
      context({ scope })
    )

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      betaEnrollment: {
        mayChange: false,
        membership: null,
        signupAvailable: true,
      },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    UserLoginScope.READ_ONLY,
    UserLoginScope.SESSION_EXEC,
  ])('rejects enrollment changes from %s sessions', async (scope) => {
    const result = await execute(
      `mutation {
          setBetaEnrollment(enabled: true) { membership }
        }`,
      context({ scope })
    )

    expect(result.errors?.[0]?.message).toBe('Unauthorized')
  })

  it.each([
    UserLoginScope.FULL_ACCESS,
    UserLoginScope.ACCOUNT_OWNER,
  ])('allows enrollment changes from %s sessions', async (scope) => {
    fetchMock
      .mockResolvedValueOnce(savedGroupResponse([]))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    const result = await execute(
      `mutation {
          setBetaEnrollment(enabled: true) { membership }
        }`,
      context({ scope })
    )

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      setBetaEnrollment: { membership: true },
    })
  })

  it.each([
    ['a non-Catalyst caller', { catalyst: false }],
    ['closed signup', { flagEnabled: false }],
  ] as const)('rejects opt-in for %s', async (_label, options) => {
    const result = await execute(
      `mutation {
        setBetaEnrollment(enabled: true) { membership }
      }`,
      context(options)
    )

    expect(result.errors?.[0]?.message).toBe('Beta enrollment is not available')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps opt-out available after signup closes', async () => {
    fetchMock
      .mockResolvedValueOnce(savedGroupResponse([USER_ID]))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))

    const result = await execute(
      `mutation {
        setBetaEnrollment(enabled: false) { membership }
      }`,
      context({ catalyst: false, flagEnabled: false })
    )

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      setBetaEnrollment: { membership: false },
    })
  })
})
