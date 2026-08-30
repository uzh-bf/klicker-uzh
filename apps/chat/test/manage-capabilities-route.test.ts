import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  close: vi.fn(),
  getAuthenticatedManageUser: vi.fn(),
  isManageAiEnabled: vi.fn(),
  loadLecturerMcpTools: vi.fn(),
}))

vi.mock('@/src/lib/server/featureFlags', () => ({
  isManageAiEnabled: mocks.isManageAiEnabled,
}))

vi.mock('@/src/lib/server/manageAuth', () => ({
  getAuthenticatedManageUser: mocks.getAuthenticatedManageUser,
}))

vi.mock('@/src/services/lecturerMcp', () => ({
  loadLecturerMcpTools: mocks.loadLecturerMcpTools,
}))

import {
  GET,
  MANAGE_CAPABILITY_TIMEOUT_MS,
} from '@/src/app/api/manage/capabilities/route'

function request() {
  return new NextRequest('https://chat.test/api/manage/capabilities')
}

async function expectState(response: Response, status: number, state: string) {
  expect(response.status).toBe(status)
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  await expect(response.json()).resolves.toEqual({ state })
}

describe('GET /api/manage/capabilities', () => {
  beforeEach(() => {
    mocks.close.mockReset().mockResolvedValue(undefined)
    mocks.getAuthenticatedManageUser.mockReset().mockResolvedValue({
      catalyst: true,
      role: 'USER',
      scope: 'FULL_ACCESS',
      sub: 'lecturer-1',
    })
    mocks.isManageAiEnabled.mockReset().mockResolvedValue(true)
    mocks.loadLecturerMcpTools.mockReset().mockResolvedValue({
      capabilityState: 'draft-and-read',
      close: mocks.close,
      sentinel: 'sentinel',
      tools: {},
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('refuses an unauthenticated request before gate or inventory work', async () => {
    mocks.getAuthenticatedManageUser.mockResolvedValue(null)

    await expectState(await GET(request()), 401, 'unavailable')
    expect(mocks.isManageAiEnabled).not.toHaveBeenCalled()
    expect(mocks.loadLecturerMcpTools).not.toHaveBeenCalled()
  })

  test('returns only unavailable when the Manage AI gate is closed', async () => {
    mocks.isManageAiEnabled.mockResolvedValue(false)

    await expectState(await GET(request()), 403, 'unavailable')
    expect(mocks.loadLecturerMcpTools).not.toHaveBeenCalled()
  })

  test.each([
    'draft-and-read',
    'read-only',
  ] as const)('returns %s from the actual inventory and closes the temporary client', async (capabilityState) => {
    mocks.loadLecturerMcpTools.mockResolvedValue({
      capabilityState,
      close: mocks.close,
      sentinel: 'sentinel',
      tools: {},
    })

    await expectState(await GET(request()), 200, capabilityState)
    expect(mocks.loadLecturerMcpTools).toHaveBeenCalledWith(
      'lecturer-1',
      'FULL_ACCESS',
      undefined,
      expect.any(AbortSignal)
    )
    expect(mocks.close).toHaveBeenCalledTimes(1)
  })

  test('degrades without returning failure detail when inventory loading fails', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.loadLecturerMcpTools.mockRejectedValue(
      new Error('private upstream detail')
    )

    await expectState(await GET(request()), 503, 'unavailable')
    expect(warning).toHaveBeenCalledWith(
      'Manage assistant capability preflight is unavailable'
    )
    warning.mockRestore()
  })

  test('aborts a slow inventory load at the bounded deadline', async () => {
    vi.useFakeTimers()
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    mocks.loadLecturerMcpTools.mockImplementation(
      (
        _userId: string,
        _scope: string,
        _sentinel: undefined,
        signal: AbortSignal
      ) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason), {
            once: true,
          })
        })
    )

    const response = GET(request())
    await vi.advanceTimersByTimeAsync(MANAGE_CAPABILITY_TIMEOUT_MS)
    await expectState(await response, 503, 'unavailable')
    warning.mockRestore()
  })
})
