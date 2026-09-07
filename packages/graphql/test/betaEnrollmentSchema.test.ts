import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import { createYoga } from 'graphql-yoga'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { schema } from '../src/index.js'
import type { Context } from '../src/lib/context.js'

const USER_ID = '00000000-0000-4000-8000-000000000001'

function createPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  }
}

type TestPrisma = ReturnType<typeof createPrisma>

function createContext({
  authenticated = true,
  catalystInstitutional = true,
  catalystIndividual = false,
  scope = UserLoginScope.FULL_ACCESS,
  prisma = createPrisma(),
}: {
  authenticated?: boolean
  catalystInstitutional?: boolean
  catalystIndividual?: boolean
  scope?: UserLoginScope
  prisma?: TestPrisma
} = {}) {
  const ctx = {
    prisma,
    user: authenticated
      ? {
          sub: USER_ID,
          role: UserRole.USER,
          scope,
          catalystInstitutional,
          catalystIndividual,
        }
      : undefined,
  } as unknown as Context

  return { ctx, prisma }
}

type GraphQLResult = {
  data?: Record<string, unknown> | null
  errors?: { extensions?: { code?: string } }[]
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
  return (await response.json()) as GraphQLResult
}

describe('beta enrollment schema authorization', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('rejects an anonymous capability query', async () => {
    const { ctx } = createContext({ authenticated: false })

    const result = await execute(
      `query {
        betaEnrollment { membership }
      }`,
      ctx
    )

    expect(result.errors).toHaveLength(1)
  })

  it.each([
    UserLoginScope.READ_ONLY,
    UserLoginScope.SESSION_EXEC,
  ])('returns an unknown capability without reading for %s sessions', async (scope) => {
    const { ctx, prisma } = createContext({ scope })

    const result = await execute(
      `query {
        betaEnrollment {
          mayChange
          membership
          signupAvailable
        }
      }`,
      ctx
    )

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      betaEnrollment: {
        mayChange: false,
        membership: null,
        signupAvailable: true,
      },
    })
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
  })

  it.each([
    UserLoginScope.FULL_ACCESS,
    UserLoginScope.ACCOUNT_OWNER,
  ])('reads the persisted capability for %s sessions', async (scope) => {
    const { ctx, prisma } = createContext({ scope })
    prisma.user.findUnique.mockResolvedValue({ betaEnabled: false })

    const result = await execute(
      `query {
        betaEnrollment {
          mayChange
          membership
          signupAvailable
        }
      }`,
      ctx
    )

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      betaEnrollment: {
        mayChange: true,
        membership: false,
        signupAvailable: true,
      },
    })
  })

  it.each([
    UserLoginScope.FULL_ACCESS,
    UserLoginScope.ACCOUNT_OWNER,
  ])('allows preference changes for %s sessions', async (scope) => {
    const { ctx, prisma } = createContext({ scope })
    prisma.user.update.mockResolvedValue({ betaEnabled: true })

    const result = await execute(
      `mutation {
        setBetaEnrollment(enabled: true) {
          mayChange
          membership
          signupAvailable
        }
      }`,
      ctx
    )

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      setBetaEnrollment: {
        mayChange: true,
        membership: true,
        signupAvailable: true,
      },
    })
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: { betaEnabled: true },
      select: { betaEnabled: true },
    })
  })

  it.each([
    UserLoginScope.READ_ONLY,
    UserLoginScope.SESSION_EXEC,
  ])('rejects preference changes for %s sessions', async (scope) => {
    const { ctx, prisma } = createContext({ scope })

    const result = await execute(
      `mutation {
        setBetaEnrollment(enabled: true) { membership }
      }`,
      ctx
    )

    expect(result.errors).toHaveLength(1)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('rejects opt-in without Catalyst with a stable protocol code', async () => {
    const { ctx, prisma } = createContext({
      catalystInstitutional: false,
      catalystIndividual: false,
    })

    const result = await execute(
      `mutation {
        setBetaEnrollment(enabled: true) { membership }
      }`,
      ctx
    )

    expect(result.errors?.[0]?.extensions?.code).toBe('FORBIDDEN')
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('allows opt-out without Catalyst for full-access users', async () => {
    const { ctx, prisma } = createContext({
      catalystInstitutional: false,
      catalystIndividual: false,
    })
    prisma.user.update.mockResolvedValue({ betaEnabled: false })

    const result = await execute(
      `mutation {
        setBetaEnrollment(enabled: false) {
          mayChange
          membership
          signupAvailable
        }
      }`,
      ctx
    )

    expect(result.errors).toBeUndefined()
    expect(result.data).toEqual({
      setBetaEnrollment: {
        mayChange: false,
        membership: false,
        signupAvailable: false,
      },
    })
  })
})
