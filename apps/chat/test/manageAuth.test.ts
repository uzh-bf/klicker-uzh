import { signJWT } from '@klicker-uzh/util'
import { cookies } from 'next/headers'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import {
  getAuthenticatedManageUser,
  getAuthenticatedManageUserId,
} from '../src/lib/server/manageAuth'

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

const TEST_SECRET = 'unit-test-app-secret-manage-auth'

function mockSessionCookie(value: string | undefined) {
  vi.mocked(cookies).mockResolvedValue({
    get: (name: string) =>
      name === 'next-auth.session-token' && value ? { name, value } : undefined,
  } as unknown as Awaited<ReturnType<typeof cookies>>)
}

describe('getAuthenticatedManageUser', () => {
  beforeEach(() => {
    vi.stubEnv('APP_SECRET', TEST_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(cookies).mockReset()
  })

  test('returns sub/role/scope for a valid lecturer session', async () => {
    const token = await signJWT(
      { sub: 'user-1', role: 'USER', scope: 'FULL_ACCESS' },
      TEST_SECRET
    )
    mockSessionCookie(token)

    await expect(getAuthenticatedManageUser()).resolves.toEqual({
      catalyst: false,
      role: 'USER',
      scope: 'FULL_ACCESS',
      sub: 'user-1',
    })
  })

  test('passes through a missing scope as undefined (pre-scope sessions)', async () => {
    const token = await signJWT({ sub: 'user-2', role: 'USER' }, TEST_SECRET)
    mockSessionCookie(token)

    await expect(getAuthenticatedManageUser()).resolves.toEqual({
      catalyst: false,
      role: 'USER',
      scope: undefined,
      sub: 'user-2',
    })
  })

  test('rejects a participant-role session', async () => {
    const token = await signJWT(
      { sub: 'participant-1', role: 'PARTICIPANT', scope: 'EDUID' },
      TEST_SECRET
    )
    mockSessionCookie(token)

    await expect(getAuthenticatedManageUser()).resolves.toBeNull()
  })

  test('accepts an admin-role session (backend role lattice: ADMIN satisfies USER gates)', async () => {
    const token = await signJWT(
      { sub: 'admin-1', role: 'ADMIN', scope: 'ACCOUNT_OWNER' },
      TEST_SECRET
    )
    mockSessionCookie(token)

    await expect(getAuthenticatedManageUser()).resolves.toEqual({
      catalyst: false,
      role: 'ADMIN',
      scope: 'ACCOUNT_OWNER',
      sub: 'admin-1',
    })
  })

  test('rejects a non-string or unknown role', async () => {
    const token = await signJWT(
      { sub: 'user-x', role: 'SOMETHING_ELSE', scope: 'FULL_ACCESS' },
      TEST_SECRET
    )
    mockSessionCookie(token)

    await expect(getAuthenticatedManageUser()).resolves.toBeNull()
  })

  test('returns null with no session cookie', async () => {
    mockSessionCookie(undefined)

    await expect(getAuthenticatedManageUser()).resolves.toBeNull()
  })

  test('returns null when APP_SECRET is not configured', async () => {
    const token = await signJWT({ sub: 'user-3', role: 'USER' }, TEST_SECRET)
    mockSessionCookie(token)
    delete process.env.APP_SECRET

    await expect(getAuthenticatedManageUser()).resolves.toBeNull()
  })

  test('returns null for a token signed with a different secret', async () => {
    const token = await signJWT({ sub: 'user-4', role: 'USER' }, 'wrong-secret')
    mockSessionCookie(token)

    await expect(getAuthenticatedManageUser()).resolves.toBeNull()
  })
})

describe('getAuthenticatedManageUserId (compat wrapper)', () => {
  beforeEach(() => {
    vi.stubEnv('APP_SECRET', TEST_SECRET)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.mocked(cookies).mockReset()
  })

  test('returns the sub for a valid lecturer session', async () => {
    const token = await signJWT({ sub: 'user-5', role: 'USER' }, TEST_SECRET)
    mockSessionCookie(token)

    await expect(getAuthenticatedManageUserId()).resolves.toBe('user-5')
  })

  test('returns null for a participant-role session', async () => {
    const token = await signJWT(
      { sub: 'participant-2', role: 'PARTICIPANT' },
      TEST_SECRET
    )
    mockSessionCookie(token)

    await expect(getAuthenticatedManageUserId()).resolves.toBeNull()
  })
})
