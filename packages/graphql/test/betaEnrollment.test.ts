import { UserLoginScope, UserRole } from '@klicker-uzh/prisma/client'
import type { Redis } from 'ioredis'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ContextWithUser } from '../src/lib/context.js'
import {
  getBetaEnrollment,
  setBetaEnrollment,
} from '../src/services/betaEnrollment.js'

const USER_ID = '00000000-0000-4000-8000-000000000001'

class FakeRedis {
  lockValue: string | null = null
  remainingLeaseMs = 8_000

  set = vi.fn(async (_key: string, value: string) => {
    if (this.lockValue !== null) return null
    this.lockValue = value
    return 'OK'
  })

  eval = vi.fn(async (script: string, _keyCount: number, ...args: string[]) => {
    const token = args[1]!
    if (script.includes('pttl')) {
      return this.lockValue === token ? this.remainingLeaseMs : -1
    }
    if (script.includes('del') && this.lockValue === token) {
      this.lockValue = null
      return 1
    }
    return 0
  })
}

function configure() {
  process.env.GROWTHBOOK_MANAGEMENT_API_URL = 'https://growthbook.test'
  process.env.GROWTHBOOK_MANAGEMENT_API_KEY = 'secret_test'
  process.env.GROWTHBOOK_BETA_SAVED_GROUP_ID = 'group_test'
}

function unconfigure() {
  delete process.env.GROWTHBOOK_MANAGEMENT_API_URL
  delete process.env.GROWTHBOOK_MANAGEMENT_API_KEY
  delete process.env.GROWTHBOOK_BETA_SAVED_GROUP_ID
}

function savedGroupResponse(values: string[], type = 'list') {
  return new Response(JSON.stringify({ savedGroup: { type, values } }), {
    status: 200,
  })
}

function createContext({
  catalyst = true,
  featureEnabled = true,
  redis = new FakeRedis(),
  scope = UserLoginScope.FULL_ACCESS,
}: {
  catalyst?: boolean
  featureEnabled?: boolean
  redis?: FakeRedis
  scope?: UserLoginScope
} = {}) {
  const refresh = vi.fn(async () => undefined)
  const ctx = {
    featureFlags: {
      isEnabled: vi.fn(() => featureEnabled),
      refresh,
    },
    redisExec: redis as unknown as Redis,
    user: {
      sub: USER_ID,
      role: UserRole.USER,
      scope,
      catalystInstitutional: catalyst,
      catalystIndividual: false,
    },
  } as unknown as ContextWithUser

  return { ctx, redis, refresh }
}

describe('beta enrollment', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    configure()
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  afterEach(() => {
    unconfigure()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('returns membership and opt-in capability for an eligible user', async () => {
    fetchMock.mockResolvedValue(savedGroupResponse([]))
    const { ctx } = createContext()

    await expect(getBetaEnrollment({}, ctx)).resolves.toEqual({
      mayChange: true,
      membership: false,
      signupAvailable: true,
    })
  })

  it('does not read the management API for a weaker login scope', async () => {
    const { ctx } = createContext({ scope: UserLoginScope.READ_ONLY })

    await expect(getBetaEnrollment({}, ctx)).resolves.toEqual({
      mayChange: false,
      membership: null,
      signupAvailable: true,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps opt-out available after signup closes or Catalyst is removed', async () => {
    fetchMock.mockResolvedValue(savedGroupResponse([USER_ID]))
    const { ctx } = createContext({ catalyst: false, featureEnabled: false })

    await expect(getBetaEnrollment({}, ctx)).resolves.toEqual({
      mayChange: true,
      membership: true,
      signupAvailable: false,
    })
  })

  it('returns unknown membership when the integration is unavailable', async () => {
    fetchMock.mockRejectedValue(new Error('unreachable'))
    const { ctx } = createContext()

    await expect(getBetaEnrollment({}, ctx)).resolves.toEqual({
      mayChange: true,
      membership: null,
      signupAvailable: true,
    })
  })

  it('returns unknown membership for a non-list saved group', async () => {
    fetchMock.mockResolvedValue(savedGroupResponse([], 'condition'))
    const { ctx } = createContext()

    await expect(getBetaEnrollment({}, ctx)).resolves.toMatchObject({
      mayChange: true,
      membership: null,
    })
  })

  it('rejects an insecure management API URL without a request', async () => {
    process.env.GROWTHBOOK_MANAGEMENT_API_URL = 'http://growthbook.test'
    const { ctx } = createContext()

    await expect(getBetaEnrollment({}, ctx)).resolves.toMatchObject({
      membership: null,
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('adds the user while preserving other saved-group members', async () => {
    fetchMock
      .mockResolvedValueOnce(savedGroupResponse(['another-user']))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const { ctx, refresh } = createContext()

    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).resolves.toMatchObject({ membership: true })

    const write = fetchMock.mock.calls[1]!
    expect(write[0]).toBe(
      'https://growthbook.test/api/v1/saved-groups/group_test'
    )
    expect(JSON.parse(write[1].body)).toEqual({
      bypassApproval: true,
      values: ['another-user', USER_ID],
    })
    expect(refresh).toHaveBeenCalledOnce()
  })

  it('does not replace the group when membership already matches', async () => {
    fetchMock.mockResolvedValueOnce(savedGroupResponse([USER_ID]))
    const { ctx } = createContext()

    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).resolves.toMatchObject({ membership: true })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('allows opt-out when signup is closed', async () => {
    fetchMock
      .mockResolvedValueOnce(savedGroupResponse(['another-user', USER_ID]))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const { ctx } = createContext({ catalyst: false, featureEnabled: false })

    await expect(setBetaEnrollment({ enabled: false }, ctx)).resolves.toEqual({
      mayChange: false,
      membership: false,
      signupAvailable: false,
    })
  })

  it('denies opt-in when Catalyst or signup eligibility is absent', async () => {
    const { ctx } = createContext({ catalyst: false })

    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).rejects.toMatchObject({ extensions: { code: 'FORBIDDEN' } })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('fails explicitly when enrollment configuration is absent', async () => {
    unconfigure()
    const { ctx } = createContext()

    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'BETA_ENROLLMENT_UNAVAILABLE' },
    })
  })

  it('reports a rejected saved-group write', async () => {
    fetchMock
      .mockResolvedValueOnce(savedGroupResponse([]))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    const { ctx } = createContext()

    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'BETA_ENROLLMENT_UPDATE_FAILED' },
    })
  })

  it('keeps successful membership when the backend refresh fails', async () => {
    fetchMock
      .mockResolvedValueOnce(savedGroupResponse([]))
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
    const { ctx, refresh } = createContext()
    refresh.mockRejectedValueOnce(new Error('refresh unavailable'))

    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).resolves.toMatchObject({ membership: true })
  })

  it('fails closed when another update holds the saved-group lock', async () => {
    const redis = new FakeRedis()
    redis.lockValue = 'another-owner'
    const { ctx } = createContext({ redis })

    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'BETA_ENROLLMENT_UPDATE_FAILED' },
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not write after losing the lock lease', async () => {
    const redis = new FakeRedis()
    fetchMock.mockImplementationOnce(async () => {
      redis.lockValue = 'replacement-owner'
      return savedGroupResponse([])
    })
    const { ctx } = createContext({ redis })

    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'BETA_ENROLLMENT_UPDATE_FAILED' },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(redis.lockValue).toBe('replacement-owner')
  })

  it('does not write without enough lease for the bounded request', async () => {
    const redis = new FakeRedis()
    redis.remainingLeaseMs = 3_500
    fetchMock.mockResolvedValue(savedGroupResponse([]))
    const { ctx } = createContext({ redis })

    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).rejects.toMatchObject({
      extensions: { code: 'BETA_ENROLLMENT_UPDATE_FAILED' },
    })
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('uses token-safe release when lock ownership changes before cleanup', async () => {
    const redis = new FakeRedis()
    fetchMock
      .mockResolvedValueOnce(savedGroupResponse([]))
      .mockImplementationOnce(async () => {
        redis.lockValue = 'replacement-owner'
        return new Response(null, { status: 200 })
      })
    const { ctx } = createContext({ redis })

    await expect(
      setBetaEnrollment({ enabled: true }, ctx)
    ).resolves.toMatchObject({ membership: true })
    expect(redis.lockValue).toBe('replacement-owner')
  })
})
