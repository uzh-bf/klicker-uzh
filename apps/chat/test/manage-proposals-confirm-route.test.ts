import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getAuthenticatedManageUser: vi.fn(),
  getManageAiCapability: vi.fn(),
  rateLimitCheck: vi.fn(),
}))

vi.mock('@/src/lib/server/featureFlags', () => ({
  getManageAiCapability: mocks.getManageAiCapability,
}))

vi.mock('@/src/lib/server/manageAuth', () => ({
  getAuthenticatedManageUser: mocks.getAuthenticatedManageUser,
}))

vi.mock('@/src/services/rateLimiter', () => ({
  createRateLimiter: () => ({ check: mocks.rateLimitCheck }),
}))

vi.mock('@/src/services/manageProposals', () => ({
  confirmManageProposal: vi.fn(),
  getRequiredManageOrigin: vi.fn(),
  recordProposalConfirmationAudit: vi.fn(),
  verifyManageProposalToken: vi.fn(),
}))

import { POST } from '@/src/app/api/manage/proposals/confirm/route'

function request() {
  return new NextRequest('https://chat.test/api/manage/proposals/confirm', {
    body: JSON.stringify({ proposalToken: 'proposal-token' }),
    method: 'POST',
  })
}

async function expectJson(response: Response, status: number, body: unknown) {
  expect(response.status).toBe(status)
  await expect(response.json()).resolves.toEqual(body)
}

describe('POST /api/manage/proposals/confirm AI boundary', () => {
  beforeEach(() => {
    mocks.getAuthenticatedManageUser.mockReset()
    mocks.getAuthenticatedManageUser.mockResolvedValue({
      role: 'USER',
      scope: 'FULL_ACCESS',
      sub: 'lecturer-1',
    })
    mocks.getManageAiCapability.mockReset()
    mocks.getManageAiCapability.mockResolvedValue('enabled')
    mocks.rateLimitCheck.mockReset()
    mocks.rateLimitCheck.mockReturnValue({
      allowed: true,
      retryAfterMs: 0,
    })
  })

  test('returns 403 for an explicit AI denial before rate limiting', async () => {
    mocks.getManageAiCapability.mockResolvedValue('disabled')

    await expectJson(await POST(request()), 403, { error: 'Not available' })
    expect(mocks.rateLimitCheck).not.toHaveBeenCalled()
  })

  test('returns a retryable 503 for a temporary AI outage before rate limiting', async () => {
    mocks.getManageAiCapability.mockResolvedValue('temporarilyUnavailable')

    const response = await POST(request())
    await expectJson(response, 503, {
      error: 'Manage assistant temporarily unavailable',
    })
    expect(response.headers.get('retry-after')).toBe('30')
    expect(mocks.rateLimitCheck).not.toHaveBeenCalled()
  })
})
